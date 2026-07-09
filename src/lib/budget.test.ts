import { describe, it, expect } from "vitest";
import { computeBudget, type BudgetItem, type BudgetInput } from "./budget";

// Build the McCann seed as GENERIC items — no venue/bar/caterer logic in code.
// This proves the data-driven engine reproduces the original hand-tuned numbers.
let sortN = 0;
const item = (p: Partial<BudgetItem> & { category: string; label: string; amount: number }): BudgetItem => ({
  id: `i${sortN}`,
  cost_type: "flat",
  taxable: true,
  service_pct: 0,
  refundable: false,
  active: true,
  group_key: null,
  sort: sortN++,
  ...p,
});

const items: BudgetItem[] = [
  // Venue (flat, taxable)
  item({ category: "Venue", label: "The Nursery", amount: 6500 }),
  item({ category: "Venue", label: "The Hilltop", amount: 2100 }),
  item({ category: "Venue", label: "Landmark fee", amount: 500 }),
  item({ category: "Venue", label: "Damage hold", amount: 1000, taxable: false, refundable: true }),
  // Bar (per guest, 18% service, taxable)
  item({ category: "Bar", label: "Beer/wine bar", amount: 55, cost_type: "per_guest", service_pct: 18 }),
  // Catering (Triple active; Double/Quad are inactive options)
  item({ category: "Catering", label: "Triple Tailgate", amount: 50, cost_type: "per_guest", group_key: "caterer" }),
  item({ category: "Catering", label: "Double Tailgate", amount: 45, cost_type: "per_guest", group_key: "caterer", active: false }),
  item({ category: "Catering", label: "Tableware", amount: 2, cost_type: "per_guest" }),
  item({ category: "Catering", label: "Delivery", amount: 250 }),
  item({ category: "Catering", label: "Rentals", amount: 200, taxable: false }),
  // Everything else (flat, untaxed in the original model)
  ...[283, 50, 1200, 1500, 0, 0, 600, 3000, 800, 0, 1000].map((amount, i) =>
    item({ category: "Other", label: `line ${i}`, amount, taxable: false })
  ),
];

const base: BudgetInput = {
  guests: 80,
  taxRate: 0.13,
  items,
  saved: 0,
  monthly: 0,
  gifts: [],
  eventDate: "2027-09-25",
  today: "2026-07-08",
};

const catTotal = (r: ReturnType<typeof computeBudget>, name: string) =>
  r.categories.find((c) => c.label === name)?.amount ?? 0;

describe("generic engine reproduces the seed totals", () => {
  it("Venue + Bar = the Quayle's total 16047 @ 80", () => {
    const r = computeBudget(base);
    expect(catTotal(r, "Venue")).toBeCloseTo(10283, 2); // 9100 + 13% tax
    expect(catTotal(r, "Bar")).toBeCloseTo(5764, 2); // 4400 + 18% + 13%
    expect(catTotal(r, "Venue") + catTotal(r, "Bar")).toBeCloseTo(16047, 2);
  });

  it("Catering = 5183.30 (rentals untaxed, tableware+delivery taxed)", () => {
    expect(catTotal(computeBudget(base), "Catering")).toBeCloseTo(5183.3, 2);
  });

  it("Other = 8433 (untaxed) and total expense = 29663.30", () => {
    const r = computeBudget(base);
    expect(catTotal(r, "Other")).toBe(8433);
    expect(r.expense).toBeCloseTo(29663.3, 2);
  });

  it("refundable damage hold is surfaced but excluded from expense", () => {
    const r = computeBudget(base);
    expect(r.refundableTotal).toBe(1000);
    expect(r.expense).toBeCloseTo(r.categories.reduce((t, c) => t + c.amount, 0), 6);
  });

  it("inactive caterer options and guest count both move totals", () => {
    const r90 = computeBudget({ ...base, guests: 90 });
    expect(r90.expense).toBeGreaterThan(computeBudget(base).expense);
    // Only the active Triple counts, not Double
    expect(r90.computed.some((c) => c.label === "Double Tailgate")).toBe(false);
  });

  it("tax rate is configurable, not hardcoded", () => {
    const noTax = computeBudget({ ...base, taxRate: 0 });
    expect(noTax.taxTotal).toBe(0);
    expect(noTax.expense).toBeLessThan(computeBudget(base).expense);
  });
});

describe("savings plan", () => {
  it("months to go from the event date", () => {
    expect(computeBudget(base).months).toBe(15);
  });
  it("on track when monthly covers the need; gifts reduce it", () => {
    const r0 = computeBudget(base);
    expect(computeBudget({ ...base, monthly: r0.neededMonthly }).onTrack).toBe(true);
    expect(computeBudget({ ...base, gifts: [{ amount: 5000 }] }).neededMonthly).toBeLessThan(r0.neededMonthly);
  });
});
