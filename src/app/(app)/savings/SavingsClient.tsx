"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";
import { money, money0 } from "@/lib/format";
import { projectCashflow } from "@/lib/cashflow";
import { summarizeFinances, toMonthly, EXPENSE_CATEGORIES, FREQUENCIES, type FinanceLine, type Frequency } from "@/lib/finance";
import { updateFinances } from "./actions";
import { addLine, updateLine, deleteLine, applyExpenseStarter } from "./finance-actions";
import { addGift, updateGift, deleteGift } from "@/app/(app)/budget/actions";

type Gift = { id: string; label: string; amount: number; on_date: string | null };
type Pay = { amount: number; date: string | null; paid: boolean };

const kFmt = (n: number) => (Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
const ACCENT = "#5B5BD6";
const FREQ_NAME: Record<Frequency, string> = { monthly: "Monthly", weekly: "Weekly", biweekly: "Bi-weekly", annual: "Annual" };

export function SavingsClient({ weddingId, eventIso, todayIso, saved: savedInit, partners, lines: linesInit, gifts: giftsInit, payments }: {
  weddingId: string; eventIso: string; todayIso: string; saved: number; partners: string[]; lines: FinanceLine[]; gifts: Gift[]; payments: Pay[];
}) {
  const [saved, setSaved] = useState(savedInit);
  const [lines, setLines] = useState<FinanceLine[]>(linesInit);
  const [gifts, setGifts] = useState<Gift[]>(giftsInit);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setLines(linesInit), [linesInit]);
  useEffect(() => setGifts(giftsInit), [giftsInit]);

  const summary = useMemo(() => summarizeFinances(lines, partners), [lines, partners]);
  const cash = useMemo(() => projectCashflow({
    startBalance: saved, monthlyIncome: summary.totalIncome, monthlyExpenses: summary.totalExpenses,
    gifts: gifts.map((g) => ({ amount: g.amount, date: g.on_date })), payments, todayIso, eventIso,
  }), [saved, summary, gifts, payments, todayIso, eventIso]);

  // Line CRUD (optimistic).
  const patchLine = (id: string, p: Partial<FinanceLine>) => { setLines((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); updateLine(id, p as never).then((r) => { if (!r.ok) setErr(r.error); }); };
  const add = (kind: "income" | "expense", person: string | null) => start(async () => {
    const r = await addLine(weddingId, kind);
    if (r.ok && r.id) setLines((xs) => [...xs, { id: r.id!, kind, label: kind === "income" ? "Income" : "Expense", amount: 0, frequency: "monthly", person, category: kind === "expense" ? "Other" : null, sort: xs.length }]);
    else if (!r.ok) setErr(r.error);
  });
  const removeLine = (id: string) => { setLines((xs) => xs.filter((x) => x.id !== id)); deleteLine(id).then((r) => { if (!r.ok) setErr(r.error); }); };
  const addStarter = () => start(async () => { const r = await applyExpenseStarter(weddingId); if (!r.ok) setErr(r.error); else setTimeout(() => location.reload(), 50); });

  const patchGift = (id: string, p: Partial<Gift>) => { setGifts((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); updateGift(id, p as never).then((r) => { if (!r.ok) setErr(r.error); }); };
  const addContribution = async () => { const r = await addGift(weddingId); if (r.ok && r.id) setGifts((xs) => [...xs, { id: r.id!, label: "Contribution", amount: 0, on_date: null }]); else if (!r.ok) setErr(r.error); };
  const removeGift = (id: string) => { setGifts((xs) => xs.filter((x) => x.id !== id)); deleteGift(id).then((r) => { if (!r.ok) setErr(r.error); }); };

  const income = lines.filter((l) => l.kind === "income");
  const expense = lines.filter((l) => l.kind === "expense");
  const incomeGroups = groupBy(income, (l) => l.person ?? "", [...partners, ""]);
  const expenseGroups = groupBy(expense, (l) => l.category ?? "Other", EXPENSE_CATEGORIES);
  const lowestLabel = cash.months.find((m) => m.ym === cash.lowestMonth)?.label ?? "—";

  return (
    <div>
      {err && <p className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      {/* ============ PERSONAL BUDGET ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Income */}
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Income</h2>
            <span className="text-xs text-muted">{money(summary.totalIncome)}/mo</span>
          </div>
          {incomeGroups.map(({ key, rows }) => (
            <div key={key || "joint"} className="mb-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">{key || "Joint"} <span className="text-muted">· {money(monthlyOf(rows))}/mo</span></p>
              {rows.map((l) => <LineRow key={l.id} line={l} partners={partners} onPatch={(p) => patchLine(l.id, p)} onDelete={() => removeLine(l.id)} />)}
            </div>
          ))}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(partners.length ? partners : [null]).map((p) => (
              <button key={p ?? "j"} onClick={() => add("income", p)} className="rounded-lg border border-dashed border-line px-2.5 py-1 text-xs text-muted hover:text-ink">+ {p ? `${p}'s income` : "Income"}</button>
            ))}
          </div>
        </section>

        {/* Expenses */}
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Living expenses</h2>
            <span className="text-xs text-muted">{money(summary.totalExpenses)}/mo</span>
          </div>
          {expenseGroups.map(({ key, rows }) => (
            <div key={key} className="mb-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">{key} <span className="text-muted">· {money(monthlyOf(rows))}/mo</span></p>
              {rows.map((l) => <LineRow key={l.id} line={l} partners={partners} showCategory onPatch={(p) => patchLine(l.id, p)} onDelete={() => removeLine(l.id)} />)}
            </div>
          ))}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button onClick={() => add("expense", null)} className="rounded-lg border border-dashed border-line px-2.5 py-1 text-xs text-muted hover:text-ink">+ Add expense</button>
            {expense.length === 0 && <button onClick={addStarter} className="rounded-lg border border-dashed border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent-weak">✨ Add common expenses</button>}
          </div>
        </section>
      </div>

      {/* Summary */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {summary.perPerson.map((p) => (
            <div key={p.person} className="rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="text-xs font-semibold">{p.person}</p>
              <p className="mt-0.5 text-xs text-muted">{money0(p.income)} − {money0(p.individualExpenses)} = <span className={`font-semibold ${p.net >= 0 ? "text-ink" : "text-bad"}`}>{money0(p.net)}</span></p>
            </div>
          ))}
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-xs font-semibold">Shared expenses</p>
            <p className="mt-0.5 text-sm tabular-nums text-muted">{money0(summary.sharedExpenses)}/mo</p>
          </div>
        </div>
        <p className="mt-3 text-sm">Together you can set aside <span className={`text-lg font-bold ${summary.capacity >= 0 ? "text-good" : "text-bad"}`}>{money(summary.capacity)}/mo</span> toward the wedding.</p>
      </div>

      {/* ============ CASH-FLOW TOWARD THE WEDDING ============ */}
      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
        <MoneyInput label="In the bank now" value={saved} onSet={(n) => { setSaved(n); updateFinances(weddingId, { saved: n }).then((r) => { if (!r.ok) setErr(r.error); }); }} />
      </div>

      <div className={`mt-4 rounded-2xl border p-5 ${cash.shortfall ? "border-bad/30 bg-bad/10" : "border-good/30 bg-good/10"}`}>
        <p className="text-sm font-semibold">{cash.shortfall ? "You’ll come up short" : "On track"}</p>
        <p className="mt-0.5 text-sm text-muted">
          {cash.shortfall
            ? <>Your balance dips to <span className="font-semibold text-bad">{money0(cash.lowestBalance)}</span> around {lowestLabel}. Save about <span className="font-semibold text-ink">{money(cash.neededMonthly)}/mo</span> to stay positive.</>
            : <>You stay positive the whole way — lowest point <span className="font-semibold text-ink">{money0(cash.lowestBalance)}</span> in {lowestLabel}.</>}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Remaining to pay" value={money0(cash.totalRemaining)} sub="unpaid on this plan" />
        <Stat label="Projected at the wedding" value={money0(cash.projectedAtWedding)} tone={cash.projectedAtWedding < 0 ? "bad" : "good"} />
        <Stat label="Needed to stay positive" value={`${money0(cash.neededMonthly)}/mo`} sub={summary.capacity >= cash.neededMonthly ? "you're above this" : "you're below this"} tone={summary.capacity >= cash.neededMonthly ? "good" : "bad"} />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Projected balance</h2>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={cash.months} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} interval="preserveStartEnd" minTickGap={28} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
              <YAxis tickFormatter={kFmt} tick={{ fontSize: 11, fill: "var(--muted)" }} width={44} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke="#d1495b" strokeWidth={1} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="endBalance" stroke={ACCENT} strokeWidth={2} fill="url(#bal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">One-off contributions</h2>
          <span className="text-xs text-faint">Gifts, family help — dated, or assumed at the wedding</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {gifts.map((g) => (
            <div key={g.id} className="group flex items-center gap-2 rounded-lg border border-line p-2">
              <TextField value={g.label} onSet={(v) => patchGift(g.id, { label: v })} className="min-w-0 flex-1 text-sm font-medium" placeholder="Contribution" />
              <MiniMoney value={g.amount} onSet={(n) => patchGift(g.id, { amount: n })} />
              <input type="date" value={g.on_date ?? ""} onChange={(e) => patchGift(g.id, { on_date: e.target.value || null })} className="flex-none rounded-md border border-line bg-surface px-1.5 py-1 text-xs" title="When you expect it (blank = at the wedding)" />
              <button onClick={() => removeGift(g.id)} className="flex-none text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad">×</button>
            </div>
          ))}
          <button onClick={addContribution} className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add contribution</button>
        </div>
      </div>
    </div>
  );
}

function groupBy(rows: FinanceLine[], keyFn: (l: FinanceLine) => string, order: string[]): { key: string; rows: FinanceLine[] }[] {
  const map = new Map<string, FinanceLine[]>();
  for (const r of rows) { const k = keyFn(r); (map.get(k) ?? map.set(k, []).get(k)!).push(r); }
  const keys = [...order.filter((k) => map.has(k)), ...[...map.keys()].filter((k) => !order.includes(k))];
  return keys.map((key) => ({ key, rows: map.get(key)! }));
}
const monthlyOf = (rows: FinanceLine[]) => rows.reduce((t, l) => t + toMonthly(l.amount, l.frequency), 0);

function LineRow({ line, partners, showCategory, onPatch, onDelete }: { line: FinanceLine; partners: string[]; showCategory?: boolean; onPatch: (p: Partial<FinanceLine>) => void; onDelete: () => void }) {
  return (
    <div className="group mb-1 rounded-lg border border-line p-2">
      <div className="flex items-center gap-2">
        <TextField value={line.label} onSet={(v) => onPatch({ label: v })} className="min-w-0 flex-1 text-sm font-medium" placeholder={line.kind === "income" ? "Source" : "Expense"} />
        <MiniMoney value={line.amount} onSet={(n) => onPatch({ amount: n })} />
        <button onClick={onDelete} className="flex-none text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad">×</button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select value={line.frequency} onChange={(e) => onPatch({ frequency: e.target.value as Frequency })} className="rounded-md border border-line bg-surface px-1 py-1 text-xs text-muted">
          {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQ_NAME[f]}</option>)}
        </select>
        <select value={line.person ?? ""} onChange={(e) => onPatch({ person: e.target.value || null })} className="rounded-md border border-line bg-surface px-1 py-1 text-xs text-muted">
          <option value="">{line.kind === "income" ? "Joint" : "Shared"}</option>
          {partners.map((p) => <option key={p} value={p}>{p}</option>)}
          {line.person && !partners.includes(line.person) && <option value={line.person}>{line.person}</option>}
        </select>
        {showCategory && (
          <select value={line.category ?? "Other"} onChange={(e) => onPatch({ category: e.target.value })} className="rounded-md border border-line bg-surface px-1 py-1 text-xs text-muted">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            {line.category && !EXPENSE_CATEGORIES.includes(line.category) && <option value={line.category}>{line.category}</option>}
          </select>
        )}
      </div>
    </div>
  );
}

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; endBalance: number; paymentsOut: number; giftsIn: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{d.label}</p>
      <p className={d.endBalance < 0 ? "text-bad" : ""}>Balance: {money0(d.endBalance)}</p>
      {d.paymentsOut > 0 && <p className="text-muted">Payments: −{money0(d.paymentsOut)}</p>}
      {d.giftsIn > 0 && <p className="text-good">Contribution: +{money0(d.giftsIn)}</p>}
    </div>
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

function MoneyInput({ label, value, onSet }: { label: string; value: number; onSet: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <label className="rounded-2xl border border-line bg-surface p-4">
      <span className="block text-xs text-muted">{label}</span>
      <span className="mt-1 flex items-center text-xl font-semibold">
        <span className="text-faint">$</span>
        <input inputMode="decimal" value={draft}
          onFocus={() => (focused.current = true)}
          onBlur={() => { focused.current = false; const n = parseFloat(draft); if (!Number.isNaN(n) && n >= 0 && n !== value) onSet(n); else setDraft(String(value)); }}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-transparent tabular-nums outline-none" />
      </span>
    </label>
  );
}

function MiniMoney({ value, onSet }: { value: number; onSet: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <span className="inline-flex flex-none items-center rounded-md border border-line bg-surface px-1.5 py-1 text-xs">
      <span className="text-faint">$</span>
      <input inputMode="decimal" value={draft}
        onFocus={() => (focused.current = true)}
        onBlur={() => { focused.current = false; setDraft(String(value)); }}
        onChange={(e) => { const s = e.target.value.replace(/[^0-9.]/g, ""); setDraft(s); const n = parseFloat(s); if (!Number.isNaN(n) && n >= 0) onSet(n); }}
        className="w-16 bg-transparent text-right outline-none" />
    </span>
  );
}

function TextField({ value, onSet, className = "", placeholder }: { value: string; onSet: (v: string) => void; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <input value={draft} placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; if (draft !== value) onSet(draft); }}
      onChange={(e) => setDraft(e.target.value)}
      className={`${className} rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-line focus:border-accent focus:bg-surface`} />
  );
}
