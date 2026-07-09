// Generic, data-driven budget engine (Section 4, rebuilt for the hub).
// PURE: no I/O, no persistence. Every wedding's budget is just a list of items;
// nothing here knows about a specific venue, caterer, bar package, or province.
// Totals are always recomputed at render time and never stored.

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

export const DEFAULT_TAX_RATE = 0.13; // e.g. Ontario HST; editable per wedding

export type CostType = "flat" | "per_guest";

// One line of the budget. `amount` is a flat cost, or a per-guest rate when
// cost_type is "per_guest". `service_pct` is an on-top charge (e.g. 18% bar
// gratuity) that is not itself taxed. `taxable` decides whether the wedding tax
// rate applies to the base. `refundable` items (deposits/holds) are surfaced
// but excluded from the expense total. `group_key` marks mutually-exclusive
// options (e.g. competing caterer quotes) — only the active one counts.
export interface BudgetItem {
  id: string;
  category: string;
  label: string;
  cost_type: CostType;
  amount: number;
  taxable: boolean;
  service_pct: number;
  refundable: boolean;
  active: boolean;
  group_key: string | null;
  sort: number;
  source_document_id?: string | null; // provenance (which uploaded quote it came from)
  bundle?: string | null; // package name (all-inclusive package spanning categories)
  vendor?: string | null; // supplier name (for obvious comparison)
  vendor_id?: string | null; // linked vendor entity (see src/lib/vendors.ts)
}

export interface BudgetInput {
  guests: number;
  taxRate: number;
  items: BudgetItem[];
  saved: number;
  monthly: number;
  gifts: { amount: number }[];
  eventDate: string | Date;
  today?: string | Date;
}

export interface ComputedItem extends BudgetItem {
  base: number;
  service: number;
  tax: number;
  total: number;
}

export interface BudgetResult {
  guests: number;
  taxRate: number;
  computed: ComputedItem[]; // active items with derived figures
  categories: { label: string; amount: number }[]; // expense grouped by category, desc
  taxTotal: number;
  serviceTotal: number;
  expense: number; // active, non-refundable
  refundableTotal: number; // surfaced, excluded from expense
  // Savings plan
  months: number;
  projected: number;
  giftsTotal: number;
  available: number;
  balance: number;
  neededMonthly: number;
  onTrack: boolean;
  breakdown: { label: string; amount: number }[]; // categories, for the donut
}

const baseOf = (it: BudgetItem, guests: number) =>
  it.cost_type === "per_guest" ? it.amount * guests : it.amount;

export function computeBudget(input: BudgetInput): BudgetResult {
  const { guests, taxRate, saved, monthly } = input;

  const computed: ComputedItem[] = input.items
    .filter((it) => it.active)
    .map((it) => {
      const base = baseOf(it, guests);
      const service = (base * it.service_pct) / 100;
      const tax = it.taxable ? base * taxRate : 0;
      return { ...it, base, service, tax, total: base + service + tax };
    });

  const spend = computed.filter((it) => !it.refundable);
  const expense = spend.reduce((t, it) => t + it.total, 0);
  const refundableTotal = computed.filter((it) => it.refundable).reduce((t, it) => t + it.total, 0);
  const taxTotal = spend.reduce((t, it) => t + it.tax, 0);
  const serviceTotal = spend.reduce((t, it) => t + it.service, 0);

  // Group expense by category.
  const byCat = new Map<string, number>();
  for (const it of spend) byCat.set(it.category, (byCat.get(it.category) ?? 0) + it.total);
  const categories = [...byCat.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Savings plan.
  const event = new Date(input.eventDate);
  const now = input.today ? new Date(input.today) : new Date();
  const months = Math.max(1, Math.round((event.getTime() - now.getTime()) / MS_PER_DAY / DAYS_PER_MONTH));
  const projected = monthly * months;
  const giftsTotal = input.gifts.reduce((t, g) => t + g.amount, 0);
  const available = saved + projected + giftsTotal;
  const balance = available - expense;
  const neededMonthly = months > 0 ? Math.max(0, (expense - saved - giftsTotal) / months) : 0;
  const onTrack = monthly >= neededMonthly;

  return {
    guests,
    taxRate,
    computed,
    categories,
    taxTotal,
    serviceTotal,
    expense,
    refundableTotal,
    months,
    projected,
    giftsTotal,
    available,
    balance,
    neededMonthly,
    onTrack,
    breakdown: categories,
  };
}
