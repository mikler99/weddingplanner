import { createClient } from "@/lib/supabase/server";
import { poolItems } from "@/lib/budget-data";
import { computeBudget } from "@/lib/budget";

export type ScenarioSummary = {
  id: string;
  name: string;
  guests: number;
  is_active: boolean;
  total: number; // expense at this scenario's guest count over its selected options
  itemCount: number;
  picks: { category: string; label: string; vendor: string | null; amount: number }[];
};

export type ScenariosView = {
  weddingId: string;
  weddingGuests: number;
  scenarios: ScenarioSummary[];
};

export type ScenarioBrief = { id: string; name: string; is_active: boolean };

// Lightweight list for the plan switcher (Hub / Budget headers).
export async function listScenarios(weddingId: string): Promise<ScenarioBrief[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scenarios")
    .select("id, name, is_active")
    .eq("wedding_id", weddingId)
    .order("sort")
    .order("created_at");
  return (data ?? []) as ScenarioBrief[];
}

// All scenarios with their comparison totals. Each total is computeBudget over
// that scenario's selected options at its own guest count.
export async function loadScenarios(weddingId: string): Promise<ScenariosView | null> {
  const supabase = await createClient();
  const [scensRes, config, wedding, pool] = await Promise.all([
    supabase.from("scenarios").select("id, name, guests, is_active").eq("wedding_id", weddingId).order("sort").order("created_at"),
    supabase.from("budget_config").select("tax_rate").eq("wedding_id", weddingId).single(),
    supabase.from("weddings").select("event_date, guest_estimate").eq("id", weddingId).single(),
    poolItems(supabase, weddingId),
  ]);
  if (!wedding.data) return null;

  const scens = scensRes.data ?? [];
  const scenIds = scens.map((s) => s.id);
  const links = scenIds.length
    ? (await supabase.from("scenario_items").select("scenario_id, item_id").in("scenario_id", scenIds)).data ?? []
    : [];

  const byId = new Map(pool.map((i) => [i.id, i]));
  const itemsFor = (sid: string) => links.filter((l) => l.scenario_id === sid).map((l) => byId.get(l.item_id as string)).filter(Boolean) as typeof pool;
  const taxRate = config.data?.tax_rate ?? 0.13;

  const scenarios: ScenarioSummary[] = scens.map((s) => {
    const items = itemsFor(s.id);
    const r = computeBudget({ guests: s.guests, taxRate, items, saved: 0, monthly: 0, gifts: [], eventDate: wedding.data!.event_date });
    return {
      id: s.id,
      name: s.name,
      guests: s.guests,
      is_active: s.is_active,
      total: r.expense,
      itemCount: items.filter((i) => !i.refundable).length,
      picks: r.computed.filter((i) => !i.refundable).map((i) => ({ category: i.category, label: i.label, vendor: i.vendor ?? null, amount: i.total })),
    };
  });

  return { weddingId, weddingGuests: wedding.data.guest_estimate, scenarios };
}
