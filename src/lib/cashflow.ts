// Month-by-month cash-flow projection toward the wedding. Pure — testable and
// usable on server or client.
//
// Model: you have money banked now (startBalance), a monthly savings capacity
// (income − living expenses), one-off contributions (gifts), and the plan's
// dated payment schedule (unpaid = future outflows). We roll the balance forward
// month by month, flag the lowest point (a shortfall if it dips below zero), and
// compute the minimum monthly capacity that keeps you in the black the whole way.

export type CashflowInput = {
  startBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  gifts: { amount: number; date: string | null }[]; // one-off inflows; null → at the wedding
  payments: { date: string | null; amount: number; paid: boolean }[]; // date = resolved ISO or null
  todayIso: string;
  eventIso: string;
};

export type CashflowMonth = { ym: string; label: string; giftsIn: number; paymentsOut: number; endBalance: number };

export type CashflowResult = {
  capacity: number; // monthly income − expenses
  months: CashflowMonth[];
  lowestBalance: number;
  lowestMonth: string | null;
  shortfall: boolean;
  projectedAtWedding: number;
  totalRemaining: number; // unpaid payments total
  neededMonthly: number; // min monthly capacity to never dip below zero
};

const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
const ymOf = (iso: string) => iso.slice(0, 7);
const labelOf = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", { month: "short", year: "numeric" });
};
const cmpYM = (a: string, b: string) => a.localeCompare(b);
const maxYM = (a: string, b: string) => (cmpYM(a, b) >= 0 ? a : b);

function monthList(startYM: string, endYM: string): string[] {
  let [y, m] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  const out: string[] = [];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${pad(m)}`);
    if (++m > 12) { m = 1; y++; }
    if (out.length > 600) break; // safety
  }
  return out;
}

export function projectCashflow(input: CashflowInput): CashflowResult {
  const capacity = input.monthlyIncome - input.monthlyExpenses;
  const startYM = ymOf(input.todayIso);
  const eventYM = ymOf(input.eventIso);

  // Bucket unpaid payments + gifts by month, clamped to >= the current month
  // (an overdue unpaid item lands this month; an undated one lands at the wedding).
  const payByYM = new Map<string, number>();
  let totalRemaining = 0;
  let endYM = eventYM;
  for (const p of input.payments) {
    if (p.paid) continue;
    totalRemaining += p.amount;
    const raw = p.date ? ymOf(p.date) : eventYM;
    const k = maxYM(raw, startYM);
    payByYM.set(k, (payByYM.get(k) ?? 0) + p.amount);
    endYM = maxYM(endYM, k);
  }
  const giftByYM = new Map<string, number>();
  for (const g of input.gifts) {
    const raw = g.date ? ymOf(g.date) : eventYM;
    const k = maxYM(raw, startYM);
    giftByYM.set(k, (giftByYM.get(k) ?? 0) + g.amount);
    endYM = maxYM(endYM, k);
  }

  const list = monthList(startYM, endYM);
  const months: CashflowMonth[] = [];
  let bal = input.startBalance;
  let lowestBalance = Infinity;
  let lowestMonth: string | null = null;
  let projectedAtWedding = input.startBalance;

  // For the needed-capacity calc: max over month i of (cumPay − start − cumGifts) / (i+1).
  let cumPay = 0;
  let cumGifts = 0;
  let neededMonthly = 0;

  list.forEach((ym, i) => {
    const giftsIn = giftByYM.get(ym) ?? 0;
    const paymentsOut = payByYM.get(ym) ?? 0;
    bal += capacity + giftsIn - paymentsOut;
    months.push({ ym, label: labelOf(ym), giftsIn, paymentsOut, endBalance: Math.round(bal) });
    if (bal < lowestBalance) { lowestBalance = bal; lowestMonth = ym; }
    if (cmpYM(ym, eventYM) <= 0) projectedAtWedding = bal;

    cumPay += paymentsOut;
    cumGifts += giftsIn;
    const need = (cumPay - input.startBalance - cumGifts) / (i + 1);
    if (need > neededMonthly) neededMonthly = need;
  });

  if (!list.length) lowestBalance = input.startBalance;

  return {
    capacity,
    months,
    lowestBalance: Math.round(lowestBalance),
    lowestMonth,
    shortfall: lowestBalance < 0,
    projectedAtWedding: Math.round(projectedAtWedding),
    totalRemaining,
    neededMonthly: Math.max(0, Math.round(neededMonthly)),
  };
}
