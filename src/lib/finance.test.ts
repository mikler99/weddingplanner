import { describe, it, expect } from "vitest";
import { toMonthly, sumMonthly, summarizeFinances, type FinanceLine } from "./finance";
import { partnerNames } from "./couple";

describe("toMonthly", () => {
  it("normalizes each frequency to a monthly figure", () => {
    expect(toMonthly(1200, "monthly")).toBe(1200);
    expect(toMonthly(120, "weekly")).toBeCloseTo((120 * 52) / 12, 6); // 520
    expect(toMonthly(200, "biweekly")).toBeCloseTo((200 * 26) / 12, 6); // 433.33
    expect(toMonthly(1200, "annual")).toBe(100);
  });
});

const line = (p: Partial<FinanceLine> & Pick<FinanceLine, "kind" | "amount">): FinanceLine => ({
  id: Math.random().toString(36).slice(2), label: "", frequency: "monthly", person: null, category: null, sort: 0, ...p,
});

describe("summarizeFinances", () => {
  it("splits per-person income minus individual expenses, and shared expenses", () => {
    const lines: FinanceLine[] = [
      line({ kind: "income", amount: 5000, person: "Michael" }),
      line({ kind: "income", amount: 4000, person: "Olivia" }),
      line({ kind: "expense", amount: 500, person: "Michael" }),  // his car payment
      line({ kind: "expense", amount: 300, person: "Olivia" }),   // her credit card
      line({ kind: "expense", amount: 2000, person: null }),      // shared rent
    ];
    const s = summarizeFinances(lines, ["Michael", "Olivia"]);
    expect(s.totalIncome).toBe(9000);
    expect(s.totalExpenses).toBe(2800);
    expect(s.sharedExpenses).toBe(2000);
    expect(s.capacity).toBe(6200);
    expect(s.perPerson).toEqual([
      { person: "Michael", income: 5000, individualExpenses: 500, net: 4500 },
      { person: "Olivia", income: 4000, individualExpenses: 300, net: 3700 },
    ]);
  });

  it("mixes frequencies via monthly normalization", () => {
    const lines: FinanceLine[] = [
      line({ kind: "income", amount: 2400, frequency: "biweekly", person: "A" }), // 5200/mo
      line({ kind: "expense", amount: 1200, frequency: "annual", person: null }), // 100/mo
    ];
    const s = summarizeFinances(lines, ["A"]);
    expect(s.totalIncome).toBeCloseTo(5200, 6);
    expect(s.totalExpenses).toBeCloseTo(100, 6);
    expect(s.capacity).toBeCloseTo(5100, 6);
  });
});

describe("sumMonthly + partnerNames", () => {
  it("sums normalized amounts", () => {
    expect(sumMonthly([{ amount: 100, frequency: "monthly" }, { amount: 1200, frequency: "annual" }])).toBe(200);
  });
  it("derives two first names from the wedding name", () => {
    expect(partnerNames("Michael & Olivia McCann")).toEqual(["Michael", "Olivia"]);
    expect(partnerNames("Sam and Alex")).toEqual(["Sam", "Alex"]);
    expect(partnerNames("")).toEqual([]);
  });
});
