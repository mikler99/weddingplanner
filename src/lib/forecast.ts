// Live cash-flow forecast — makes the bank balance mean something by projecting
// it forward against WHEN money actually moves: recurring paychecks/bills (from
// Plaid's predicted next dates) and scheduled wedding payments. Pure + testable.

import type { Frequency } from "@/lib/finance";

export type RecurringFlow = { label: string; amount: number; nextDate: string; frequency: Frequency; kind: "income" | "bill" };
export type DatedFlow = { label: string; amount: number; date: string };

export type ForecastInput = {
  balance: number;
  today: string;              // YYYY-MM-DD
  horizonDays: number;        // how far to project (e.g. 60)
  recurring: RecurringFlow[];
  weddingPayments: DatedFlow[];
};

export type Flow = { label: string; amount: number; date: string; kind: "income" | "bill" | "wedding" };

export type Forecast = {
  balance: number;                              // starting real balance
  days: { date: string; balance: number }[];   // running balance per day
  upcoming: Flow[];                              // dated flows within the horizon, sorted
  lowest: { date: string; balance: number };
  nextIncome: Flow | null;
  committed: number;                            // outflows due on/before the next paycheck
  safeToSpend: number;                          // balance − committed (≥ 0)
  free: number;                                 // same as safeToSpend, for the balance breakdown
  endBalance: number;                           // projected balance at the horizon
  shortfalls: { label: string; date: string; amount: number; balanceBefore: number }[]; // wedding pmts you're projected short for
};

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");

function step(d: Date, f: Frequency): Date {
  const n = new Date(d);
  if (f === "weekly") n.setUTCDate(n.getUTCDate() + 7);
  else if (f === "biweekly") n.setUTCDate(n.getUTCDate() + 14);
  else if (f === "annual") n.setUTCFullYear(n.getUTCFullYear() + 1);
  else n.setUTCMonth(n.getUTCMonth() + 1); // monthly (and default)
  return n;
}

// Expand a recurring stream into its occurrences within [today, end].
function occurrences(nextDate: string, frequency: Frequency, today: Date, end: Date): string[] {
  let d = parse(nextDate);
  let guard = 0;
  while (d < today && guard++ < 500) d = step(d, frequency); // roll a stale predicted date forward
  const out: string[] = [];
  guard = 0;
  while (d <= end && guard++ < 500) { out.push(iso(d)); d = step(d, frequency); }
  return out;
}

export function forecastCashflow(input: ForecastInput): Forecast {
  const today = parse(input.today);
  const end = new Date(today.getTime() + input.horizonDays * DAY);

  const flows: Flow[] = [];
  for (const r of input.recurring) {
    if (!(r.amount > 0)) continue;
    for (const date of occurrences(r.nextDate, r.frequency, today, end)) {
      flows.push({ label: r.label, amount: r.amount, date, kind: r.kind });
    }
  }
  for (const p of input.weddingPayments) {
    const d = parse(p.date);
    if (p.amount > 0 && d >= today && d <= end) flows.push({ label: p.label, amount: p.amount, date: p.date, kind: "wedding" });
  }
  flows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // Daily running balance across the horizon.
  const byDay = new Map<string, Flow[]>();
  for (const f of flows) (byDay.get(f.date) ?? byDay.set(f.date, []).get(f.date)!).push(f);
  const days: { date: string; balance: number }[] = [];
  let bal = input.balance;
  let lowest = { date: input.today, balance: bal };
  for (let t = today.getTime(); t <= end.getTime(); t += DAY) {
    const key = iso(new Date(t));
    for (const f of byDay.get(key) ?? []) bal += f.kind === "income" ? f.amount : -f.amount;
    days.push({ date: key, balance: Math.round(bal * 100) / 100 });
    if (bal < lowest.balance) lowest = { date: key, balance: Math.round(bal * 100) / 100 };
  }

  const nextIncome = flows.find((f) => f.kind === "income") ?? null;
  const cutoff = nextIncome ? nextIncome.date : iso(end);
  const committed = flows.filter((f) => f.kind !== "income" && f.date <= cutoff).reduce((s, f) => s + f.amount, 0);
  const safeToSpend = Math.max(0, Math.round((input.balance - committed) * 100) / 100);

  // Wedding payments you're projected to be short for (balance the day before < payment).
  const shortfalls: Forecast["shortfalls"] = [];
  for (const f of flows) {
    if (f.kind !== "wedding") continue;
    const before = days.find((d) => d.date === f.date);
    const balanceBefore = (before ? before.balance : input.balance) + f.amount; // add back same-day debit to see pre-payment balance
    if (balanceBefore < f.amount) shortfalls.push({ label: f.label, date: f.date, amount: f.amount, balanceBefore: Math.round(balanceBefore * 100) / 100 });
  }

  return {
    balance: Math.round(input.balance * 100) / 100,
    days,
    upcoming: flows,
    lowest,
    nextIncome,
    committed: Math.round(committed * 100) / 100,
    safeToSpend,
    free: safeToSpend,
    endBalance: days.length ? days[days.length - 1].balance : input.balance,
    shortfalls,
  };
}
