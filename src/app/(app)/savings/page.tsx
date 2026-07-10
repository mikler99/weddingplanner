import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { loadPlanContext } from "@/lib/budget-data";
import { resolveDue, type DueRule } from "@/lib/payments";
import { partnerNames } from "@/lib/couple";
import type { FinanceLine } from "@/lib/finance";
import { SavingsClient } from "./SavingsClient";

export default async function SavingsPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { wedding_id } = await requireModule("savings");
  const { scenario } = await searchParams;
  const supabase = await createClient();
  const ctx = await loadPlanContext(supabase, wedding_id, scenario);

  const [wRes, cRes, gRes, pRes, fRes, scensRes] = await Promise.all([
    supabase.from("weddings").select("name, event_date").eq("id", wedding_id).single(),
    supabase.from("budget_config").select("saved").eq("wedding_id", wedding_id).single(),
    supabase.from("gifts").select("id, label, amount, on_date, sort").eq("wedding_id", wedding_id).order("sort"),
    ctx ? supabase.from("payments").select("amount, due_date, due_rule, paid").eq("scenario_id", ctx.scenarioId) : Promise.resolve({ data: [] }),
    supabase.from("finance_lines").select("id, kind, label, amount, frequency, person, category, sort").eq("wedding_id", wedding_id).order("sort"),
    supabase.from("scenarios").select("id, name, is_active").eq("wedding_id", wedding_id).order("sort").order("created_at"),
  ]);
  const eventDate = wRes.data?.event_date ?? null;
  if (!eventDate) return null;

  const payments = ((pRes.data ?? []) as { amount: number; due_date: string | null; due_rule: DueRule | null; paid: boolean }[]).map((p) => ({
    amount: Number(p.amount),
    paid: p.paid,
    date: resolveDue(p.due_rule ?? null, p.due_date, eventDate).date,
  }));

  const lines: FinanceLine[] = (fRes.data ?? []).map((l) => ({
    id: l.id, kind: l.kind, label: l.label, amount: Number(l.amount), frequency: l.frequency, person: l.person, category: l.category, sort: l.sort,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Money</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Budget & savings</h1>
        <p className="text-sm text-muted">Your household budget → what you can set aside each month, projected against <span className="font-medium text-ink">{ctx?.name ?? "your plan"}</span>’s payments.</p>
      </header>
      <SavingsClient
        weddingId={wedding_id}
        eventIso={eventDate}
        todayIso={new Date().toISOString().slice(0, 10)}
        saved={Number(cRes.data?.saved ?? 0)}
        partners={partnerNames(wRes.data?.name)}
        lines={lines}
        gifts={(gRes.data ?? []).map((g) => ({ id: g.id, label: g.label, amount: Number(g.amount), on_date: g.on_date }))}
        payments={payments}
        scenarioId={ctx?.scenarioId ?? ""}
        isActivePlan={ctx?.isActive ?? true}
        scenarios={(scensRes.data ?? []) as { id: string; name: string; is_active: boolean }[]}
      />
    </main>
  );
}
