import { describe, it, expect } from "vitest";
import { projectCashflow } from "./cashflow";

const base = {
  todayIso: "2026-07-01",
  eventIso: "2027-09-25",
  gifts: [] as { amount: number; date: string | null }[],
  payments: [] as { date: string | null; amount: number; paid: boolean }[],
};

describe("projectCashflow", () => {
  it("capacity = income − expenses", () => {
    const r = projectCashflow({ ...base, startBalance: 5000, monthlyIncome: 6000, monthlyExpenses: 4500 });
    expect(r.capacity).toBe(1500);
  });

  it("rolls the balance forward across every month to the wedding", () => {
    const r = projectCashflow({ ...base, startBalance: 0, monthlyIncome: 1000, monthlyExpenses: 0 });
    // Jul 2026 → Sep 2027 inclusive = 15 months.
    expect(r.months.length).toBe(15);
    expect(r.months[0].endBalance).toBe(1000); // first month adds one capacity
    expect(r.projectedAtWedding).toBe(15000);
    expect(r.shortfall).toBe(false);
  });

  it("flags a shortfall when a big payment outruns savings", () => {
    const r = projectCashflow({
      ...base,
      startBalance: 1000,
      monthlyIncome: 500,
      monthlyExpenses: 0,
      payments: [{ date: "2026-09-01", amount: 10000, paid: false }],
    });
    expect(r.shortfall).toBe(true);
    expect(r.lowestBalance).toBeLessThan(0);
    expect(r.neededMonthly).toBeGreaterThan(500);
  });

  it("ignores paid payments but counts unpaid toward totalRemaining", () => {
    const r = projectCashflow({
      ...base,
      startBalance: 2000,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      payments: [
        { date: "2026-08-01", amount: 1000, paid: true },
        { date: "2027-01-01", amount: 800, paid: false },
      ],
    });
    expect(r.totalRemaining).toBe(800);
    expect(r.projectedAtWedding).toBe(1200); // 2000 − 800 unpaid
  });

  it("undated gifts land at the wedding month; dated gifts land earlier", () => {
    const early = projectCashflow({ ...base, startBalance: 0, monthlyIncome: 0, monthlyExpenses: 0, gifts: [{ amount: 3000, date: "2026-12-01" }] });
    expect(early.lowestBalance).toBe(0); // gift arrives Dec, never negative
    const late = projectCashflow({ ...base, startBalance: 0, monthlyIncome: 0, monthlyExpenses: 0, gifts: [{ amount: 3000, date: null }], payments: [{ date: "2026-08-01", amount: 1000, paid: false }] });
    expect(late.lowestBalance).toBe(-1000); // payment in Aug before the wedding gift
  });
});
