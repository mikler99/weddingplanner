"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { money, money0 } from "@/lib/format";
import { getForecast } from "./plaid-actions";
import type { Forecast, Flow } from "@/lib/forecast";

const ACCENT = "#5B5BD6";
const fmtDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });

export function CashflowCockpit({ scenarioId, eventIso }: { scenarioId: string; eventIso: string }) {
  const [state, setState] = useState<{ loading: boolean; forecast?: Forecast; pending?: boolean; hasRecurring?: boolean; error?: string; notLinked?: boolean }>({ loading: true });

  const load = () => {
    setState((s) => ({ ...s, loading: true }));
    getForecast(scenarioId, eventIso).then((r) => {
      if (!r.ok) setState({ loading: false, notLinked: r.error === "No bank linked.", error: r.error });
      else setState({ loading: false, forecast: r.forecast, pending: r.pending, hasRecurring: r.hasRecurring });
    }).catch(() => setState({ loading: false, error: "Couldn’t load your forecast." }));
  };
  useEffect(load, [scenarioId, eventIso]);

  if (state.notLinked) return null; // BankConnection handles linking

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">What’s really yours to spend</h2>
        <button onClick={load} disabled={state.loading} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-50">{state.loading ? "…" : "Refresh"}</button>
      </div>

      {state.loading && !state.forecast ? (
        <p className="py-6 text-center text-sm text-muted">Reading your accounts…</p>
      ) : state.error && !state.forecast ? (
        <p className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>
      ) : state.forecast ? (
        <Cockpit f={state.forecast} pending={state.pending} hasRecurring={state.hasRecurring} />
      ) : null}
    </section>
  );
}

function Cockpit({ f, pending, hasRecurring }: { f: Forecast; pending?: boolean; hasRecurring?: boolean }) {
  const nextPay = f.nextIncome;
  const chartData = f.days.filter((_, i) => i % 1 === 0).map((d) => ({ ...d, label: fmtDay(d.date) }));
  const dipsNegative = f.lowest.balance < 0;

  return (
    <div>
      {/* Balance in context */}
      <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-line bg-ground p-4">
          <p className="text-xs text-muted">Safe to spend right now</p>
          <p className={`mt-0.5 text-3xl font-bold tabular-nums ${f.safeToSpend > 0 ? "text-good" : "text-bad"}`}>{money0(f.safeToSpend)}</p>
          <p className="mt-1 text-xs text-muted">
            of {money0(f.balance)} in the bank{nextPay ? <> — after {money0(f.committed)} of bills before your next paycheck ({fmtDay(nextPay.date)})</> : <> — after {money0(f.committed)} of upcoming bills</>}.
          </p>
          {/* committed vs free bar */}
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="bg-bad/60" style={{ width: `${pct(f.committed, f.balance)}%` }} title="Committed to bills" />
            <div className="bg-good/70" style={{ width: `${pct(f.free, f.balance)}%` }} title="Free" />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-faint">
            <span>◼ {money0(f.committed)} committed</span>
            <span>{money0(f.free)} free ◼</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-ground p-4">
          <p className="text-xs text-muted">Over the next 60 days</p>
          <p className="mt-0.5 text-sm">Lowest point: <span className={`font-semibold tabular-nums ${dipsNegative ? "text-bad" : "text-ink"}`}>{money0(f.lowest.balance)}</span> around {fmtDay(f.lowest.date)}</p>
          <p className="mt-1 text-sm">Projected balance: <span className="font-semibold tabular-nums">{money0(f.endBalance)}</span></p>
          {nextPay && <p className="mt-1 text-xs text-muted">Next income: {nextPay.label} +{money0(nextPay.amount)} on {fmtDay(nextPay.date)}</p>}
        </div>
      </div>

      {/* Nudges */}
      {(dipsNegative || f.shortfalls.length > 0) && (
        <div className="mt-4 space-y-1.5">
          {dipsNegative && <Nudge>Heads up — you’re projected to dip to <strong>{money0(f.lowest.balance)}</strong> around {fmtDay(f.lowest.date)}. Hold off on big spends until after then.</Nudge>}
          {f.shortfalls.map((s, i) => <Nudge key={i}>You may be short for <strong>{s.label}</strong> ({money0(s.amount)}) on {fmtDay(s.date)} — projected balance {money0(s.balanceBefore - s.amount)} after it.</Nudge>)}
        </div>
      )}

      {pending && <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">Your bank is still preparing recurring-transaction history — bills will fill in here within a few minutes. The balance above is live.</p>}
      {!pending && !hasRecurring && <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">No recurring bills detected yet — link longer-standing accounts or check back once more history is available.</p>}

      {/* Timeline */}
      {f.days.length > 1 && (
        <div className="mt-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-faint">Balance over the next 60 days</p>
          <div className="h-40 w-full">
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={Math.max(0, Math.floor(chartData.length / 6))} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={44} tickFormatter={(v) => money0(v as number)} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={0} stroke="#d1495b" strokeWidth={1} />
                <Area type="monotone" dataKey="balance" stroke={ACCENT} strokeWidth={2} fill="url(#cf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {f.upcoming.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-faint">What’s coming</p>
          <div className="space-y-1">
            {f.upcoming.slice(0, 8).map((u, i) => <EventRow key={i} f={u} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0);

function Nudge({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">⚠ {children}</p>;
}

function EventRow({ f }: { f: Flow }) {
  const income = f.kind === "income";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-14 flex-none text-xs text-faint">{fmtDay(f.date)}</span>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${income ? "bg-good" : f.kind === "wedding" ? "bg-accent" : "bg-muted"}`} />
      <span className="min-w-0 flex-1 truncate">{f.label}{f.kind === "wedding" && <span className="ml-1 text-[11px] text-accent">wedding</span>}</span>
      <span className={`tabular-nums ${income ? "text-good" : ""}`}>{income ? "+" : "−"}{money0(f.amount)}</span>
    </div>
  );
}

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; balance: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return <div className="rounded-md border border-line bg-surface px-2 py-1 text-xs shadow"><p>{p.label}</p><p className={p.balance < 0 ? "text-bad" : ""}>{money(p.balance)}</p></div>;
}
