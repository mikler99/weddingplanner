import { createClient } from "@/lib/supabase/server";
import { loadBudgetData } from "@/lib/budget-data";
import { computeBudget, type BudgetResult } from "@/lib/budget";
import { resolveDue, type DueRule } from "@/lib/payments";
import { projectCashflow } from "@/lib/cashflow";

export type Payment = {
  id: string;
  label: string;
  due_date: string | null;
  due_rule: DueRule | null;
  amount: number;
  paid: boolean;
  dueLabel: string; // resolved from due_rule + wedding date
};
export type Milestone = {
  id: string;
  when_label: string;
  due_date: string | null;
  task: string;
  owner: string | null;
  done: boolean;
};

export type Dashboard = {
  wedding: {
    id: string;
    name: string;
    event_date: string;
    venue_name: string | null;
    guest_estimate: number;
    budget_target: number | null;
  };
  budget: BudgetResult; // derived totals (expense, available, balance, months…)
  monthly: number; // planned monthly savings (= budget capacity)
  // Real cash-flow health (same engine as /savings) so the hub agrees with it.
  cash: { capacity: number; shortfall: boolean; neededMonthly: number; projectedAtWedding: number; lowestBalance: number };
  counts: { vendors: number; vendorsBooked: number; documents: number; guestsResponded: number; guestsTotal: number };
  payments: Payment[]; // unpaid, soonest first
  paidTotal: number;
  tasks: Milestone[]; // open, soonest first
  openTaskCount: number;
};

// One connected read for the hub: money (budget engine + cash-flow projection),
// the plan's payment schedule, open tasks, and live module counts.
export async function loadDashboard(weddingId: string): Promise<Dashboard | null> {
  const supabase = await createClient();
  const data = await loadBudgetData(weddingId);
  if (!data) return null;

  const budget = computeBudget({
    guests: data.wedding.guest_estimate,
    taxRate: data.taxRate,
    items: data.items,
    saved: data.saved,
    monthly: data.monthly,
    gifts: data.gifts,
    eventDate: data.wedding.event_date,
  });

  const [target, payments, milestones, vendors, vendorsBooked, documents, guests, fin, dgifts] = await Promise.all([
    supabase.from("weddings").select("budget_target").eq("id", weddingId).single(),
    supabase.from("payments").select("id, label, due_date, due_rule, amount, paid").eq("scenario_id", data.activeScenarioId ?? ""),
    supabase.from("milestones").select("id, when_label, due_date, due_rule, task, owner, done").eq("scenario_id", data.activeScenarioId ?? ""),
    supabase.from("vendors").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId),
    supabase.from("vendors").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId).eq("status", "Booked"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId),
    supabase.from("guests").select("rsvp").eq("wedding_id", weddingId),
    supabase.from("budget_config").select("monthly_income, monthly_expenses").eq("wedding_id", weddingId).single(),
    supabase.from("gifts").select("amount, on_date").eq("wedding_id", weddingId),
  ]);

  const eventDate = data.wedding.event_date;
  const allPayments: (Payment & { sort: string; date: string | null })[] = (payments.data ?? []).map((p) => {
    const r = resolveDue((p.due_rule as DueRule | null) ?? null, p.due_date, eventDate);
    return { id: p.id, label: p.label, due_date: p.due_date, due_rule: p.due_rule as DueRule | null, amount: p.amount, paid: p.paid, dueLabel: r.label, sort: r.sort, date: r.date };
  });
  const allTasks: (Milestone & { sort: string })[] = (milestones.data ?? []).map((t) => {
    const r = resolveDue((t.due_rule as DueRule | null) ?? null, t.due_date, eventDate);
    return { id: t.id, when_label: t.when_label || r.label, due_date: t.due_date, task: t.task, owner: t.owner, done: t.done, sort: r.sort };
  });
  const guestRows = guests.data ?? [];

  // Cash-flow projection — identical inputs to /savings (dated payments + itemized
  // income/expenses + saved + dated gifts) so both surfaces report the same health.
  const cash = projectCashflow({
    startBalance: data.saved,
    monthlyIncome: Number(fin.data?.monthly_income ?? 0),
    monthlyExpenses: Number(fin.data?.monthly_expenses ?? 0),
    gifts: (dgifts.data ?? []).map((g) => ({ amount: Number(g.amount), date: g.on_date })),
    payments: allPayments.map((p) => ({ amount: p.amount, paid: p.paid, date: p.date })),
    todayIso: new Date().toISOString().slice(0, 10),
    eventIso: eventDate,
  });

  return {
    wedding: { ...data.wedding, budget_target: target.data?.budget_target ?? null },
    budget,
    monthly: data.monthly,
    cash: { capacity: cash.capacity, shortfall: cash.shortfall, neededMonthly: cash.neededMonthly, projectedAtWedding: cash.projectedAtWedding, lowestBalance: cash.lowestBalance },
    counts: {
      vendors: vendors.count ?? 0,
      vendorsBooked: vendorsBooked.count ?? 0,
      documents: documents.count ?? 0,
      guestsResponded: guestRows.filter((g) => g.rsvp === "yes" || g.rsvp === "no").length,
      guestsTotal: guestRows.length,
    },
    payments: allPayments.filter((p) => !p.paid).sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 5),
    paidTotal: allPayments.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0),
    tasks: allTasks.filter((t) => !t.done).sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 6),
    openTaskCount: allTasks.filter((t) => !t.done).length,
  };
}
