// Personal-budget primitives — pure, client + server safe.
// Income/expense lines carry a pay frequency; everything normalizes to monthly.

export const FREQUENCIES = ["monthly", "weekly", "biweekly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQ_LABEL: Record<Frequency, string> = { monthly: "/mo", weekly: "/wk", biweekly: "/2wk", annual: "/yr" };

export type FinanceLine = {
  id: string;
  kind: "income" | "expense";
  label: string;
  amount: number;
  frequency: Frequency;
  person: string | null; // null = shared / household
  category: string | null;
  sort: number;
};

export function toMonthly(amount: number, freq: Frequency): number {
  switch (freq) {
    case "weekly": return (amount * 52) / 12;
    case "biweekly": return (amount * 26) / 12;
    case "annual": return amount / 12;
    default: return amount;
  }
}

export const sumMonthly = (lines: { amount: number; frequency: Frequency }[]) =>
  lines.reduce((t, l) => t + toMonthly(l.amount, l.frequency), 0);

export type FinanceSummary = {
  perPerson: { person: string; income: number; individualExpenses: number; net: number }[];
  sharedExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  capacity: number; // totalIncome − totalExpenses (monthly)
};

// Roll itemized lines up into monthly totals + a per-partner breakdown
// (their income minus the expenses tagged to them; shared expenses are separate).
export function summarizeFinances(lines: FinanceLine[], partners: string[]): FinanceSummary {
  const income = lines.filter((l) => l.kind === "income");
  const expense = lines.filter((l) => l.kind === "expense");
  const totalIncome = sumMonthly(income);
  const totalExpenses = sumMonthly(expense);
  const sharedExpenses = sumMonthly(expense.filter((l) => !l.person));

  const perPerson = partners.map((person) => {
    const inc = sumMonthly(income.filter((l) => l.person === person));
    const exp = sumMonthly(expense.filter((l) => l.person === person));
    return { person, income: inc, individualExpenses: exp, net: inc - exp };
  });

  return { perPerson, sharedExpenses, totalIncome, totalExpenses, capacity: totalIncome - totalExpenses };
}

export const EXPENSE_CATEGORIES = ["Housing", "Utilities", "Food", "Transportation", "Insurance", "Debt", "Health", "Subscriptions", "Personal", "Other"];

// One-click "common expenses" starter (amounts 0 — the couple fills them in).
export const EXPENSE_STARTER: { label: string; category: string }[] = [
  { label: "Rent / mortgage", category: "Housing" },
  { label: "Utilities (hydro, gas, water)", category: "Utilities" },
  { label: "Groceries", category: "Food" },
  { label: "Car payment", category: "Transportation" },
  { label: "Gas / transit", category: "Transportation" },
  { label: "Phone & internet", category: "Utilities" },
  { label: "Insurance", category: "Insurance" },
  { label: "Credit card / loan payment", category: "Debt" },
  { label: "Subscriptions & streaming", category: "Subscriptions" },
];
