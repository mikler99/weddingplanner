import { createClient } from "@/lib/supabase/server";
import { loadBudgetData } from "@/lib/budget-data";
import { computeBudget, type BudgetResult } from "@/lib/budget";
import { resolveDue, type DueRule } from "@/lib/payments";

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
  budget: BudgetResult; // derived totals (expense, available, balance, onTrack, months…)
  monthly: number; // current planned monthly contribution (an input, not derived)
  counts: { vendors: number; documents: number; guestsResponded: number; guestsTotal: number };
  payments: Payment[]; // unpaid, soonest first
  paidTotal: number;
  tasks: Milestone[]; // open, soonest first
  openTaskCount: number;
};

// One connected read for the hub: money (via the budget engine), plus the
// payment schedule and open tasks that tie the pillars together.
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

  const [target, payments, milestones, vendors, documents, guests] = await Promise.all([
    supabase.from("weddings").select("budget_target").eq("id", weddingId).single(),
    supabase.from("payments").select("id, label, due_date, due_rule, amount, paid").eq("wedding_id", weddingId),
    supabase.from("milestones").select("id, when_label, due_date, task, owner, done").eq("wedding_id", weddingId),
    supabase.from("vendors").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId),
    supabase.from("guests").select("rsvp").eq("wedding_id", weddingId),
  ]);

  const byDate = <T extends { due_date: string | null }>(a: T, b: T) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

  // Resolve each payment's due date from its rule + the wedding date.
  const allPayments: (Payment & { sort: string })[] = (payments.data ?? []).map((p) => {
    const r = resolveDue((p.due_rule as DueRule | null) ?? null, p.due_date, data.wedding.event_date);
    return { ...(p as Payment), dueLabel: r.label, sort: r.sort };
  });
  const allTasks = (milestones.data ?? []) as Milestone[];
  const guestRows = guests.data ?? [];

  return {
    wedding: { ...data.wedding, budget_target: target.data?.budget_target ?? null },
    budget,
    monthly: data.monthly,
    counts: {
      vendors: vendors.count ?? 0,
      documents: documents.count ?? 0,
      guestsResponded: guestRows.filter((g) => g.rsvp === "yes" || g.rsvp === "no").length,
      guestsTotal: guestRows.length,
    },
    payments: allPayments.filter((p) => !p.paid).sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 5),
    paidTotal: allPayments.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0),
    tasks: allTasks.filter((t) => !t.done).sort(byDate).slice(0, 6),
    openTaskCount: allTasks.filter((t) => !t.done).length,
  };
}
