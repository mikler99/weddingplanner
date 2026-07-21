import { describe, it, expect } from "vitest";
import { forecastCashflow } from "./forecast";

describe("forecastCashflow", () => {
  const base = {
    today: "2026-07-25",
    horizonDays: 60,
    recurring: [
      { label: "Netflix", amount: 50, nextDate: "2026-07-28", frequency: "monthly" as const, kind: "bill" as const },
      { label: "Rent", amount: 1000, nextDate: "2026-08-01", frequency: "monthly" as const, kind: "bill" as const },
      { label: "Paycheck", amount: 2500, nextDate: "2026-08-07", frequency: "biweekly" as const, kind: "income" as const },
    ],
    weddingPayments: [{ label: "Venue deposit", amount: 900, date: "2026-08-20" }],
  };

  it("decomposes the balance: committed before next paycheck vs. safe to spend", () => {
    const f = forecastCashflow({ balance: 1500, ...base });
    // Netflix 50 (07-28) + Rent 1000 (08-01) fall before the 08-07 paycheck.
    expect(f.committed).toBe(1050);
    expect(f.safeToSpend).toBe(450);
    expect(f.free).toBe(450);
    expect(f.nextIncome?.amount).toBe(2500);
  });

  it("finds the low point (right before payday)", () => {
    const f = forecastCashflow({ balance: 1500, ...base });
    expect(f.lowest.balance).toBe(450);
    expect(f.lowest.date).toBe("2026-08-01");
  });

  it("projects recurring occurrences across the horizon (paycheck recurs)", () => {
    const f = forecastCashflow({ balance: 1500, ...base });
    const paychecks = f.upcoming.filter((u) => u.label === "Paycheck");
    expect(paychecks.length).toBeGreaterThanOrEqual(3); // biweekly over 60 days
    expect(f.endBalance).toBeGreaterThan(1500); // income outpaces the modeled bills
  });

  it("flags a wedding payment you're projected short for", () => {
    const f = forecastCashflow({
      balance: 500,
      today: "2026-07-25",
      horizonDays: 60,
      recurring: [{ label: "Netflix", amount: 50, nextDate: "2026-07-28", frequency: "monthly", kind: "bill" }],
      weddingPayments: [{ label: "Big vendor", amount: 2000, date: "2026-07-30" }],
    });
    expect(f.shortfalls.length).toBe(1);
    expect(f.shortfalls[0].label).toBe("Big vendor");
    expect(f.lowest.balance).toBeLessThan(0);
  });

  it("rolls a stale predicted date forward instead of dumping it all on day one", () => {
    const f = forecastCashflow({
      balance: 1000,
      today: "2026-07-25",
      horizonDays: 40,
      recurring: [{ label: "Old rent", amount: 300, nextDate: "2026-06-01", frequency: "monthly", kind: "bill" }],
      weddingPayments: [],
    });
    // The 06-01 date is stale; occurrences should land in the future window, not before today.
    expect(f.upcoming.every((u) => u.date >= "2026-07-25")).toBe(true);
    expect(f.upcoming.length).toBeGreaterThanOrEqual(1);
  });
});
