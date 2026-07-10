import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/wedding";
import { loadBudgetOverview } from "@/lib/categories";
import { money, money0 } from "@/lib/format";
import { listScenarios } from "@/lib/scenarios";
import { setTarget } from "./actions";
import { GuestControl } from "./GuestControl";
import { SavingsCard } from "./SavingsCard";
import { ScenarioBar } from "../ScenarioBar";
import { PackageForm } from "./PackageForm";

export default async function BudgetOverview({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { wedding_id } = await requireModule("budget");
  const { scenario } = await searchParams;
  const [o, scenarios] = await Promise.all([loadBudgetOverview(wedding_id, scenario), listScenarios(wedding_id)]);
  if (!o) notFound();

  const { result: r, wedding: w, categories } = o;
  const target = w.budget_target;
  const pct = target && target > 0 ? Math.min(100, Math.round((r.expense / target) * 100)) : null;
  const spendCats = categories.filter((c) => c.committed > 0);
  const started = categories.filter((c) => c.itemCount > 0).length;
  const q = o.isActive ? "" : `?scenario=${o.scenarioId}`; // keep editing this scenario when drilling in

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Budget</h1>
          <p className="text-sm text-muted">
            {o.isActive ? "The active plan" : `Editing “${o.scenarioName}” — not the plan yet`} · {started} of {categories.length} categories started.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {scenarios.length > 0 && <ScenarioBar weddingId={wedding_id} scenarios={scenarios} viewedId={o.scenarioId} isActive={o.isActive} />}
          <GuestControl weddingId={w.id} initial={o.guests} scenarioId={o.scenarioId} isActive={o.isActive} />
        </div>
      </header>

      {/* Hero */}
      <section className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Total budget</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{money0(r.expense)}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted">
            {target ? (
              <>
                <span className={r.expense > target ? "text-bad" : "text-good"}>
                  {r.expense > target ? `${money0(r.expense - target)} over` : `${money0(target - r.expense)} under`}
                </span>
                <span>· target {money0(target)}</span>
              </>
            ) : (
              <form action={setTarget.bind(null, w.id)} className="flex items-center gap-2">
                <span>Set a target:</span>
                <input name="target" inputMode="decimal" placeholder="$35,000" className="w-28 rounded-md border border-line px-2 py-1 text-sm" />
                <button className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white">Set</button>
              </form>
            )}
          </div>
          {pct != null && (
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.expense > (target ?? 0) ? "var(--bad)" : "var(--accent)" }} />
            </div>
          )}
          {r.refundableTotal > 0 && (
            <p className="mt-3 text-xs text-faint">+ {money0(r.refundableTotal)} refundable (held, not spent) · incl. {money0(r.taxTotal)} tax</p>
          )}
        </div>

        <SavingsCard weddingId={w.id} expense={r.expense} months={r.months} saved={o.saved} monthly={o.monthly} gifts={o.gifts} />
      </section>

      {/* Spend bar */}
      {spendCats.length > 0 && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex h-3.5 overflow-hidden rounded-lg border border-line">
            {spendCats.map((c) => (
              <div key={c.id} style={{ flex: c.committed, background: c.color }} title={`${c.name}: ${money0(c.committed)}`} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {spendCats.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.name} · <span className="font-semibold text-ink tabular-nums">{money0(c.committed)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category cards */}
      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Categories</h2>
        <span className="text-xs text-muted">open one to compare options & decide</span>
      </div>
      <div className="mb-4">
        <PackageForm weddingId={wedding_id} scenarioId={o.scenarioId} categories={categories.map((c) => c.name)} />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/budget/${c.slug}${q}`}
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: c.color }} />
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-lg" style={{ background: `color-mix(in srgb, ${c.color} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 32%, transparent)` }} />
              <span className="text-sm font-semibold">{c.name}</span>
            </div>
            {c.vendor && <p className="mt-1 truncate text-xs text-muted">{c.vendor}</p>}
            <div className={`mt-3 text-2xl font-bold tabular-nums ${c.committed ? "" : "text-faint"}`}>
              {c.committed ? money0(c.committed) : "—"}
            </div>
            <div className="mt-2">
              {c.status === "none" ? (
                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-faint">Not started</span>
              ) : (
                <span className="text-xs text-muted">{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
