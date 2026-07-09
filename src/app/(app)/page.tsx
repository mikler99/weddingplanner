import Link from "next/link";
import { requireMembership } from "@/lib/wedding";
import { loadDashboard } from "@/lib/dashboard-data";
import { listScenarios } from "@/lib/scenarios";
import { money, money0 } from "@/lib/format";
import { setBudgetTarget } from "./home-actions";
import { Checklist } from "./Checklist";
import { PlanSwitcher } from "./PlanSwitcher";

const PILLARS = [
  { href: "/budget", title: "Budget", desc: "Live totals from guests + vendors", live: true },
  { href: "/documents", title: "Documents", desc: "Upload quotes, extract with AI", live: true },
  { href: "/vendors", title: "Vendors", desc: "Suppliers, status & contracts", live: true },
  { href: "/calendar", title: "Calendar", desc: "Payment plan & to-dos on a timeline", live: true },
  { href: "/savings", title: "Budget & savings", desc: "Personal budget → savings & cash-flow", live: true },
  { href: "/guests", title: "Guests & RSVP", desc: "Guest list, headcount, responses", live: true },
];

export default async function Home() {
  const { wedding_id } = await requireMembership();
  const [d, scenarios] = await Promise.all([loadDashboard(wedding_id), listScenarios(wedding_id)]);
  if (!d) return null;

  const { wedding: w, budget: b } = d;
  const overTarget = w.budget_target != null && b.expense > w.budget_target;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Your wedding hub</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">{w.name}</h1>
          <p className="text-sm text-muted">
            {w.venue_name ? `${w.venue_name} · ` : ""}
            {w.event_date} · {b.months} months to go · {w.guest_estimate} guests
          </p>
        </div>
        {scenarios.length > 0 && <PlanSwitcher weddingId={wedding_id} scenarios={scenarios} />}
      </header>

      {/* Money at a glance */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Estimated cost" value={money0(b.expense)} />
        <TargetStat weddingId={w.id} target={w.budget_target} over={overTarget} />
        <Stat label="Available" value={money0(b.available)} sub={`${money0(d.paidTotal)} paid`} />
        <Stat label={b.balance < 0 ? "Shortfall" : "Surplus"} value={money0(Math.abs(b.balance))} tone={b.balance < 0 ? "bad" : "good"} />
      </section>

      {/* Savings status */}
      <section className={`mt-4 rounded-2xl border p-5 ${b.onTrack ? "border-good/30 bg-good/10" : "border-warn/30 bg-warn/10"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{b.onTrack ? "On track" : "Behind plan"}</p>
          <p className="text-sm text-muted">
            Save <span className="font-semibold text-ink">{money(b.neededMonthly)}/mo</span> to cover{" "}
            {money0(b.expense)} across {b.months} months
            {d.monthly > 0 && ` · currently saving ${money0(d.monthly)}/mo`}
          </p>
        </div>
        <Link href="/savings" className="mt-1 inline-block text-xs text-accent hover:underline">
          Plan savings & cash-flow →
        </Link>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Panel title="Next payments" href="/calendar" count={d.payments.length}>
          <Checklist
            kind="payment"
            empty="Nothing outstanding."
            items={d.payments.map((p) => ({ id: p.id, label: p.label, meta: p.dueLabel, amount: p.amount, done: false }))}
          />
        </Panel>
        <Panel title="Next tasks" href="/calendar" count={d.openTaskCount}>
          <Checklist
            kind="task"
            empty="All caught up."
            items={d.tasks.map((t) => ({ id: t.id, label: t.task, meta: t.when_label, done: false }))}
          />
        </Panel>
      </div>

      {/* Pillars */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-muted">Everything in one place</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) =>
            p.live ? (
              <Link key={p.title} href={p.href} className="rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-sm font-medium">{p.title} →</p>
                <p className="mt-0.5 text-xs text-muted">{p.desc}</p>
              </Link>
            ) : (
              <div key={p.title} className="rounded-2xl border border-dashed border-line p-4 opacity-60">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted">{p.desc}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-faint">Soon</p>
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "bad" ? "text-bad" : tone === "good" ? "text-good" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}

function TargetStat({ weddingId, target, over }: { weddingId: string; target: number | null; over: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">Budget target</p>
      {target != null ? (
        <p className={`mt-1 text-xl font-semibold tabular-nums ${over ? "text-bad" : ""}`}>{money0(target)}</p>
      ) : (
        <form action={setBudgetTarget.bind(null, weddingId)} className="mt-1 flex gap-1">
          <input name="target" inputMode="decimal" placeholder="Set target" className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm" />
          <button className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white">Set</button>
        </form>
      )}
      {over && <p className="mt-0.5 text-xs text-bad">over target</p>}
    </div>
  );
}

function Panel({ title, href, count, children }: { title: string; href?: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">
          {title} {count > 0 && <span className="text-faint">({count})</span>}
        </h2>
        {href && <Link href={href} className="text-xs text-accent hover:underline">All →</Link>}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}
