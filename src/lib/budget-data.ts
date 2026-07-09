import { createClient } from "@/lib/supabase/server";
import type { BudgetItem } from "@/lib/budget";

export type Gift = { id: string; label: string; amount: number; sort: number };

const ITEM_COLS =
  "id, category, label, cost_type, amount, taxable, service_pct, refundable, active, group_key, sort, source_document_id, bundle, vendor, vendor_id";

export type BudgetData = {
  wedding: { id: string; name: string; event_date: string; venue_name: string | null; guest_estimate: number };
  taxRate: number;
  saved: number;
  monthly: number;
  items: BudgetItem[]; // the ACTIVE scenario's selected options
  gifts: Gift[];
  activeScenarioId: string | null;
};

// Loads the inputs the budget derives from, for the wedding's ACTIVE scenario
// (the plan). `items` are the options that scenario selects — the pool lives in
// budget_items; scenario_items is the selection. All under the user's RLS.
export async function loadBudgetData(weddingId: string): Promise<BudgetData | null> {
  const supabase = await createClient();

  const [wedding, config, gifts, scen] = await Promise.all([
    supabase.from("weddings").select("id, name, event_date, venue_name, guest_estimate").eq("id", weddingId).single(),
    supabase.from("budget_config").select("tax_rate, saved, monthly").eq("wedding_id", weddingId).single(),
    supabase.from("gifts").select("id, label, amount, sort").eq("wedding_id", weddingId).order("sort"),
    supabase.from("scenarios").select("id").eq("wedding_id", weddingId).eq("is_active", true).maybeSingle(),
  ]);

  if (wedding.error || !wedding.data || config.error || !config.data) return null;

  const activeScenarioId = scen.data?.id ?? null;
  const items = activeScenarioId ? await selectedItems(supabase, weddingId, activeScenarioId) : [];

  return {
    wedding: wedding.data,
    taxRate: config.data.tax_rate ?? 0.13,
    saved: config.data.saved ?? 0,
    monthly: config.data.monthly ?? 0,
    items,
    gifts: (gifts.data ?? []) as Gift[],
    activeScenarioId,
  };
}

// Items selected by a scenario (join through scenario_items).
export async function selectedItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string,
  scenarioId: string
): Promise<BudgetItem[]> {
  const sel = await supabase.from("scenario_items").select("item_id").eq("scenario_id", scenarioId);
  const ids = (sel.data ?? []).map((r) => r.item_id as string);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("budget_items").select(ITEM_COLS).eq("wedding_id", weddingId).in("id", ids).order("category").order("sort");
  return (data ?? []) as BudgetItem[];
}

export type PlanContext = { scenarioId: string; name: string; guests: number; isActive: boolean; items: BudgetItem[] };

// Load a specific scenario's context (its selected options + guest count),
// defaulting to the active plan. This is what lets the Budget section view/edit
// ANY scenario, not just the active one.
export async function loadPlanContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string,
  scenarioId?: string
): Promise<PlanContext | null> {
  let row: { id: string; name: string; guests: number; is_active: boolean } | null = null;
  if (scenarioId) {
    row = (await supabase.from("scenarios").select("id, name, guests, is_active").eq("id", scenarioId).eq("wedding_id", weddingId).maybeSingle()).data;
  }
  if (!row) {
    row = (await supabase.from("scenarios").select("id, name, guests, is_active").eq("wedding_id", weddingId).eq("is_active", true).maybeSingle()).data;
  }
  if (!row) return null;
  const items = await selectedItems(supabase, weddingId, row.id);
  return { scenarioId: row.id, name: row.name, guests: row.guests, isActive: row.is_active, items };
}

// The full option pool (all candidates, regardless of scenario).
export async function poolItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weddingId: string
): Promise<BudgetItem[]> {
  const { data } = await supabase.from("budget_items").select(ITEM_COLS).eq("wedding_id", weddingId).order("category").order("sort");
  return (data ?? []) as BudgetItem[];
}
