import { requireMembership } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { loadPlanContext } from "@/lib/budget-data";
import { loadSuggestions } from "@/lib/planner-suggestions";
import type { DueRule } from "@/lib/payments";
import { CalendarClient, type CalPayment, type CalTask } from "./CalendarClient";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { wedding_id } = await requireMembership();
  const { scenario } = await searchParams;
  const supabase = await createClient();

  const ctx = await loadPlanContext(supabase, wedding_id, scenario);
  if (!ctx) return null;

  const [wRes, pRes, tRes, vRes, scensRes, suggestions] = await Promise.all([
    supabase.from("weddings").select("event_date").eq("id", wedding_id).single(),
    supabase.from("payments").select("id, label, amount, due_date, due_rule, paid, vendor_id").eq("scenario_id", ctx.scenarioId),
    supabase.from("milestones").select("id, task, due_date, due_rule, done, owner, vendor_id").eq("scenario_id", ctx.scenarioId),
    supabase.from("vendors").select("id, name").eq("wedding_id", wedding_id).order("name"),
    supabase.from("scenarios").select("id, name, is_active").eq("wedding_id", wedding_id).order("sort").order("created_at"),
    loadSuggestions(wedding_id, ctx.scenarioId),
  ]);
  const eventDate = wRes.data?.event_date ?? null;

  const payments: CalPayment[] = (pRes.data ?? []).map((p) => ({
    id: p.id, label: p.label, amount: Number(p.amount), due_date: p.due_date, due_rule: (p.due_rule as DueRule | null) ?? null, paid: p.paid, vendor_id: p.vendor_id,
  }));
  const tasks: CalTask[] = (tRes.data ?? []).map((t) => ({
    id: t.id, task: t.task, due_date: t.due_date, due_rule: (t.due_rule as DueRule | null) ?? null, done: t.done, owner: t.owner, vendor_id: t.vendor_id,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Planner</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted">The payment plan and to-dos for this plan. Each scenario keeps its own — switch plans to see theirs.</p>
      </header>
      <CalendarClient
        weddingId={wedding_id}
        scenarioId={ctx.scenarioId}
        scenarios={(scensRes.data ?? []) as { id: string; name: string; is_active: boolean }[]}
        isActivePlan={ctx.isActive}
        eventDate={eventDate}
        todayIso={new Date().toISOString().slice(0, 10)}
        payments={payments}
        tasks={tasks}
        vendors={(vRes.data ?? []).map((v) => ({ id: v.id, name: v.name ?? "Vendor" }))}
        suggestions={suggestions}
      />
    </main>
  );
}
