import { createClient } from "@/lib/supabase/server";
import { poolItems, loadPlanContext } from "@/lib/budget-data";
import { computeBudget, type BudgetItem } from "@/lib/budget";
import type { Vendor, VendorCard } from "@/lib/vendors-core";

// Vendors are the supplier CRM: who you're talking to, their status, contracts,
// the options they offer, and their cost in the active plan. Scenarios remain the
// cost-mixing layer; a payment/task follows the plan via the vendors it uses.

export { VENDOR_STATUSES } from "@/lib/vendors-core";
export type { Vendor, VendorCard } from "@/lib/vendors-core";

const VCOLS = "id, wedding_id, name, category, contact, email, phone, website, notes, next_step, status, sort";

// vendor_ids whose options the given scenario (default: active plan) selects.
export async function activeVendorIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string,
  scenarioId?: string
): Promise<Set<string>> {
  const ctx = await loadPlanContext(supabase, weddingId, scenarioId);
  const ids = new Set<string>();
  for (const it of ctx?.items ?? []) if (it.vendor_id) ids.add(it.vendor_id);
  return ids;
}

export async function loadVendors(weddingId: string): Promise<{ vendors: VendorCard[]; planName: string } | null> {
  const supabase = await createClient();
  const [vRes, pool, docsRes, scensRes, ctx, config, wRes] = await Promise.all([
    supabase.from("vendors").select(VCOLS).eq("wedding_id", weddingId).order("status").order("name"),
    poolItems(supabase, weddingId),
    supabase.from("documents").select("id, vendor_id").eq("wedding_id", weddingId),
    supabase.from("scenarios").select("id, name").eq("wedding_id", weddingId),
    loadPlanContext(supabase, weddingId),
    supabase.from("budget_config").select("tax_rate").eq("wedding_id", weddingId).single(),
    supabase.from("weddings").select("event_date, guest_estimate").eq("id", weddingId).single(),
  ]);
  if (!ctx || !wRes.data) return null;

  const scenarioIds = (scensRes.data ?? []).map((s) => s.id);
  const scenNameById = new Map((scensRes.data ?? []).map((s) => [s.id, s.name]));
  const siRes = scenarioIds.length
    ? await supabase.from("scenario_items").select("scenario_id, item_id").in("scenario_id", scenarioIds)
    : { data: [] as { scenario_id: string; item_id: string }[] };

  const itemById = new Map<string, BudgetItem>(pool.map((i) => [i.id, i]));
  const optionsByVendor = new Map<string, BudgetItem[]>();
  for (const it of pool) if (it.vendor_id) (optionsByVendor.get(it.vendor_id) ?? optionsByVendor.set(it.vendor_id, []).get(it.vendor_id)!).push(it);

  const docCountByVendor = new Map<string, number>();
  for (const d of docsRes.data ?? []) if (d.vendor_id) docCountByVendor.set(d.vendor_id, (docCountByVendor.get(d.vendor_id) ?? 0) + 1);

  // scenario → the vendor_ids it uses
  const scenarioVendors = new Map<string, Set<string>>();
  for (const si of siRes.data ?? []) {
    const vid = itemById.get(si.item_id)?.vendor_id;
    if (!vid) continue;
    (scenarioVendors.get(vid) ?? scenarioVendors.set(vid, new Set()).get(vid)!).add(si.scenario_id);
  }

  const selectedIds = new Set(ctx.items.map((i) => i.id));
  const taxRate = config.data?.tax_rate ?? 0.13;

  const vendors: VendorCard[] = (vRes.data ?? []).map((v) => {
    const options = optionsByVendor.get(v.id) ?? [];
    const inPlan = options.filter((o) => selectedIds.has(o.id));
    const planCost = inPlan.length
      ? computeBudget({ guests: ctx.guests, taxRate, items: inPlan, saved: 0, monthly: 0, gifts: [], eventDate: wRes.data!.event_date }).expense
      : 0;
    const scenIds = scenarioVendors.get(v.id) ?? new Set<string>();
    return {
      ...(v as Vendor),
      categories: [...new Set(options.map((o) => o.category))],
      optionCount: options.length,
      inPlanCount: inPlan.length,
      planCost,
      docCount: docCountByVendor.get(v.id) ?? 0,
      scenarioNames: [...scenIds].map((id) => scenNameById.get(id) ?? "").filter(Boolean),
    };
  });

  return { vendors, planName: ctx.name };
}
