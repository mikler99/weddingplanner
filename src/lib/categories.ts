import { createClient } from "@/lib/supabase/server";
import { poolItems, loadPlanContext, type BudgetData } from "@/lib/budget-data";
import { computeBudget, type BudgetResult, type BudgetItem } from "@/lib/budget";

export type Category = { id: string; name: string; slug: string; color: string; sort: number };
export type CategoryRollup = Category & {
  committed: number;
  itemCount: number;
  status: "set" | "none";
  vendor: string | null; // common supplier of the selected options
};

const FALLBACK = "#7A8290";

async function fetchCategories(weddingId: string): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("budget_categories")
    .select("id, name, slug, color, sort")
    .eq("wedding_id", weddingId)
    .order("sort")
    .order("name");
  return (data ?? []) as Category[];
}

// Ensures a category row exists for every category an item uses (defensive —
// e.g. a freshly ingested category), so nothing is orphaned from the UI.
function mergeItemCategories(cats: Category[], items: BudgetItem[]): Category[] {
  const known = new Set(cats.map((c) => c.name));
  const extra = [...new Set(items.map((i) => i.category))]
    .filter((n) => !known.has(n))
    .map((name, i) => ({
      id: `derived-${i}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      color: FALLBACK,
      sort: 50,
    }));
  return [...cats, ...extra].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export type Overview = {
  wedding: BudgetData["wedding"] & { budget_target: number | null };
  result: BudgetResult;
  saved: number;
  monthly: number;
  gifts: BudgetData["gifts"];
  categories: CategoryRollup[];
  scenarioId: string;
  scenarioName: string;
  isActive: boolean; // whether the viewed scenario is the plan
  guests: number; // the viewed scenario's guest count
};

// Overview of a scenario (defaults to the active plan). Pass scenarioId to
// view/preview a different mix without committing to it.
export async function loadBudgetOverview(weddingId: string, scenarioId?: string): Promise<Overview | null> {
  const supabase = await createClient();
  const [ctx, config, wedding, cats] = await Promise.all([
    loadPlanContext(supabase, weddingId, scenarioId),
    supabase.from("budget_config").select("tax_rate, saved, monthly").eq("wedding_id", weddingId).single(),
    supabase.from("weddings").select("id, name, event_date, venue_name, guest_estimate, budget_target").eq("id", weddingId).single(),
    fetchCategories(weddingId),
  ]);
  if (!ctx || !config.data || !wedding.data) return null;

  const result = computeBudget({
    guests: ctx.guests,
    taxRate: config.data.tax_rate ?? 0.13,
    items: ctx.items,
    saved: config.data.saved ?? 0,
    monthly: config.data.monthly ?? 0,
    gifts: [], // savings gifts loaded below for the card
    eventDate: wedding.data.event_date,
  });
  const gifts = (await supabase.from("gifts").select("id, label, amount, sort").eq("wedding_id", weddingId).order("sort")).data ?? [];

  const committedBy = new Map(result.categories.map((c) => [c.label, c.amount]));
  const countBy = new Map<string, number>();
  const vendorBy = new Map<string, string | null | "__multi__">();
  for (const it of ctx.items) {
    countBy.set(it.category, (countBy.get(it.category) ?? 0) + 1);
    const v = it.vendor ?? null;
    if (!vendorBy.has(it.category)) vendorBy.set(it.category, v);
    else if (vendorBy.get(it.category) !== v) vendorBy.set(it.category, "__multi__");
  }

  const categories: CategoryRollup[] = mergeItemCategories(cats, ctx.items).map((c) => {
    const itemCount = countBy.get(c.name) ?? 0;
    const v = vendorBy.get(c.name);
    return { ...c, committed: committedBy.get(c.name) ?? 0, itemCount, status: itemCount ? "set" : "none", vendor: v === "__multi__" || v === undefined ? null : v };
  });

  return {
    wedding: { ...wedding.data, budget_target: wedding.data.budget_target ?? null },
    result,
    saved: config.data.saved ?? 0,
    monthly: config.data.monthly ?? 0,
    gifts: gifts as BudgetData["gifts"],
    categories,
    scenarioId: ctx.scenarioId,
    scenarioName: ctx.name,
    isActive: ctx.isActive,
    guests: ctx.guests,
  };
}

export type CategoryView = {
  wedding: BudgetData["wedding"];
  category: Category;
  categories: Category[]; // for the tab bar
  items: BudgetItem[]; // the OPTION POOL in this category (selected + not)
  selectedIds: string[]; // options the VIEWED scenario selects
  scenarioId: string; // the scenario being edited (viewed)
  scenarioName: string;
  isActive: boolean; // whether the viewed scenario is the plan
  scenarios: { id: string; name: string; is_active: boolean }[];
  guests: number;
  taxRate: number;
  result: BudgetResult; // viewed-scenario totals (for share + rail)
  categoryTotal: number;
  docLabels: Record<string, string>; // source_document_id → document label
};

// Load a category's option pool + which options the VIEWED scenario selects
// (defaults to the active plan; pass scenarioId to edit another mix).
export async function loadCategory(weddingId: string, slug: string, scenarioId?: string): Promise<CategoryView | null> {
  const supabase = await createClient();
  const [ctx, wedding, config, pool, cats, docsRes, scensRes] = await Promise.all([
    loadPlanContext(supabase, weddingId, scenarioId),
    supabase.from("weddings").select("id, name, event_date, venue_name, guest_estimate").eq("id", weddingId).single(),
    supabase.from("budget_config").select("tax_rate").eq("wedding_id", weddingId).single(),
    poolItems(supabase, weddingId),
    fetchCategories(weddingId),
    supabase.from("documents").select("id, label").eq("wedding_id", weddingId),
    supabase.from("scenarios").select("id, name, is_active").eq("wedding_id", weddingId).order("sort").order("created_at"),
  ]);
  if (!ctx || !wedding.data || !config.data) return null;

  const catsMerged = mergeItemCategories(cats, pool);
  const category = catsMerged.find((c) => c.slug === slug);
  if (!category) return null;

  const selectedIds = ctx.items.map((i) => i.id);
  const docLabels: Record<string, string> = Object.fromEntries((docsRes.data ?? []).map((d) => [d.id, d.label]));

  const result = computeBudget({
    guests: ctx.guests,
    taxRate: config.data.tax_rate ?? 0.13,
    items: ctx.items,
    saved: 0, monthly: 0, gifts: [],
    eventDate: wedding.data.event_date,
  });

  return {
    wedding: wedding.data,
    category,
    categories: catsMerged,
    items: pool.filter((i) => i.category === category.name),
    selectedIds,
    scenarioId: ctx.scenarioId,
    scenarioName: ctx.name,
    isActive: ctx.isActive,
    scenarios: (scensRes.data ?? []) as { id: string; name: string; is_active: boolean }[],
    guests: ctx.guests,
    taxRate: config.data.tax_rate ?? 0.13,
    result,
    categoryTotal: result.categories.find((c) => c.label === category.name)?.amount ?? 0,
    docLabels,
  };
}
