"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { money0 } from "@/lib/format";
import { resolveDue, type DueRule } from "@/lib/payments";
import type { Suggestions, PaymentSuggestion, TaskSuggestion } from "@/lib/planner-suggestions";
import * as actions from "./actions";

// Anchor styled as a button — used for month navigation so it keeps working for
// view-only members (who sit inside a disabled <fieldset> that would disable a
// real <button>). Navigation, not mutation, so it's fine to leave enabled.
function MonthNav({ onClick, className, children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <a role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`cursor-pointer select-none rounded-md border border-line text-muted hover:text-ink ${className ?? ""}`}>{children}</a>
  );
}

export type CalPayment = { id: string; label: string; amount: number; due_date: string | null; due_rule: DueRule | null; paid: boolean; vendor_id: string | null };
export type CalTask = { id: string; task: string; due_date: string | null; due_rule: DueRule | null; done: boolean; owner: string | null; vendor_id: string | null };
type Vendor = { id: string; name: string };
type Scenario = { id: string; name: string; is_active: boolean };

const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (iso: string) => new Date(iso + "T00:00:00");
const fmtHuman = (iso: string) => parseIso(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RULE_PRESETS: { label: string; rule: DueRule }[] = [
  { label: "At booking", rule: { kind: "on_booking", value: null, unit: null, date: null } },
  { label: "2 weeks before", rule: { kind: "before_event", value: 2, unit: "weeks", date: null } },
  { label: "1 month before", rule: { kind: "before_event", value: 1, unit: "months", date: null } },
  { label: "3 months before", rule: { kind: "before_event", value: 3, unit: "months", date: null } },
  { label: "6 months before", rule: { kind: "before_event", value: 6, unit: "months", date: null } },
  { label: "9 months before", rule: { kind: "before_event", value: 9, unit: "months", date: null } },
  { label: "12 months before", rule: { kind: "before_event", value: 12, unit: "months", date: null } },
];

export function CalendarClient({ weddingId, scenarioId, scenarios, isActivePlan, eventDate, todayIso, payments, tasks, vendors, suggestions }: {
  weddingId: string; scenarioId: string; scenarios: Scenario[]; isActivePlan: boolean; eventDate: string | null; todayIso: string; payments: CalPayment[]; tasks: CalTask[]; vendors: Vendor[]; suggestions: Suggestions;
}) {
  const router = useRouter();
  const [pays, setPays] = useState(payments);
  const [todos, setTodos] = useState(tasks);
  const [sug, setSug] = useState(suggestions);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setPays(payments), [payments]);
  useEffect(() => setTodos(tasks), [tasks]);
  useEffect(() => setSug(suggestions), [suggestions]);

  const ev = eventDate ?? "";
  const payWhen = (p: CalPayment) => resolveDue(p.due_rule, p.due_date, ev);
  const taskWhen = (t: CalTask) => resolveDue(t.due_rule, t.due_date, ev);

  const initIso = useMemo(() => {
    const ds = [...pays.filter((p) => !p.paid).map((p) => payWhen(p).date), ...todos.filter((t) => !t.done).map((t) => taskWhen(t).date)]
      .filter((d): d is string => !!d && d >= todayIso).sort();
    return ds[0] ?? todayIso;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initD = parseIso(initIso);
  const [view, setView] = useState({ y: initD.getFullYear(), m: initD.getMonth() });

  const patchPay = (id: string, p: Partial<CalPayment>) => { setPays((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); actions.updatePayment(id, p as never).then((r) => { if (!r.ok) setErr(r.error); }); };
  const patchTask = (id: string, p: Partial<CalTask>) => { setTodos((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); actions.updateTask(id, p as never).then((r) => { if (!r.ok) setErr(r.error); }); };
  const addPay = () => start(async () => { const r = await actions.addPayment(weddingId, scenarioId); if (r.ok && r.id) setPays((xs) => [...xs, { id: r.id!, label: "New payment", amount: 0, due_date: null, due_rule: null, paid: false, vendor_id: null }]); else if (!r.ok) setErr(r.error); });
  const addTask = () => start(async () => { const r = await actions.addTask(weddingId, scenarioId); if (r.ok && r.id) setTodos((xs) => [...xs, { id: r.id!, task: "New to-do", due_date: null, due_rule: null, done: false, owner: null, vendor_id: null }]); else if (!r.ok) setErr(r.error); });
  const delPay = (id: string) => { setPays((xs) => xs.filter((x) => x.id !== id)); actions.deletePayment(id).then((r) => { if (!r.ok) setErr(r.error); }); };
  const delTask = (id: string) => { setTodos((xs) => xs.filter((x) => x.id !== id)); actions.deleteTask(id).then((r) => { if (!r.ok) setErr(r.error); }); };

  const acceptPayment = (s: PaymentSuggestion) => start(async () => {
    setSug((x) => ({ ...x, payments: x.payments.filter((p) => p.source_item_key !== s.source_item_key || p.source_document_id !== s.source_document_id) }));
    const r = await actions.addSuggestedPayment(weddingId, scenarioId, { label: s.label, amount: s.amount, due_date: s.due_date, due_rule: s.due_rule, vendor_id: s.vendor_id, source_document_id: s.source_document_id, source_item_key: s.source_item_key });
    if (!r.ok) setErr(r.error); else router.refresh();
  });
  const acceptTask = (s: TaskSuggestion) => start(async () => {
    setSug((x) => ({ ...x, tasks: x.tasks.filter((t) => t.task !== s.task) }));
    const r = await actions.addSuggestedTask(weddingId, scenarioId, s.task, s.rule);
    if (!r.ok) setErr(r.error); else router.refresh();
  });

  const byDay = useMemo(() => {
    const m = new Map<string, { pays: CalPayment[]; todos: CalTask[] }>();
    const slot = (iso: string) => m.get(iso) ?? m.set(iso, { pays: [], todos: [] }).get(iso)!;
    for (const p of pays) { const d = payWhen(p).date; if (d) slot(d).pays.push(p); }
    for (const t of todos) { const d = taskWhen(t).date; if (d) slot(d).todos.push(t); }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pays, todos, ev]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startD = new Date(view.y, view.m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(startD); d.setDate(startD.getDate() + i); return d; });
  }, [view]);
  const shiftMonth = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const dueTotal = pays.filter((p) => !p.paid).reduce((n, p) => n + p.amount, 0);
  const paidTotal = pays.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0);
  const sortedPays = [...pays].sort((a, b) => (payWhen(a).date ?? "9999").localeCompare(payWhen(b).date ?? "9999"));
  const sortedTasks = [...todos].sort((a, b) => (taskWhen(a).date ?? "9999").localeCompare(taskWhen(b).date ?? "9999"));

  return (
    <div>
      {err && <p className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Plan
          <select value={scenarioId} onChange={(e) => router.push(`/calendar?scenario=${e.target.value}`)} className="rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium text-ink">
            {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (the plan)" : ""}</option>)}
          </select>
        </label>
        {!isActivePlan && <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn">viewing a non-active plan</span>}
        <Link href={isActivePlan ? "/savings" : `/savings?scenario=${scenarioId}`} className="ml-auto text-sm text-accent hover:underline">See cash-flow →</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* CALENDAR */}
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{MONTHS[view.m]} {view.y}</h2>
            {/* Anchors (not <button>) so month navigation still works for
                view-only members, who are inside a disabled <fieldset>. */}
            <div className="flex items-center gap-1">
              <MonthNav onClick={() => { const d = parseIso(todayIso); setView({ y: d.getFullYear(), m: d.getMonth() }); }} className="px-2 py-1 text-xs font-medium">Today</MonthNav>
              <MonthNav onClick={() => shiftMonth(-1)} className="px-2 py-1 text-sm">‹</MonthNav>
              <MonthNav onClick={() => shiftMonth(1)} className="px-2 py-1 text-sm">›</MonthNav>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
            {WEEK.map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const iso = isoOf(d);
              const inMonth = d.getMonth() === view.m;
              const bucket = byDay.get(iso);
              const n = (bucket?.pays.length ?? 0) + (bucket?.todos.length ?? 0);
              return (
                <div key={i} className={`h-24 min-w-0 overflow-hidden border-b border-r border-line p-1 ${i % 7 === 0 ? "border-l" : ""} ${!inMonth ? "bg-surface-2/30" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${iso === todayIso ? "bg-accent font-bold text-white" : inMonth ? "text-muted" : "text-faint"}`}>{d.getDate()}</span>
                    {iso === eventDate && <span title="Wedding day" className="text-xs">💍</span>}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {bucket?.pays.slice(0, 2).map((p) => (
                      <div key={p.id} title={`${p.label} — ${money0(p.amount)}`} className={`flex items-center gap-1 truncate rounded px-1 text-[10px] ${p.paid ? "bg-good/15 text-good line-through" : "bg-accent-weak text-accent"}`}><span className="flex-none">●</span><span className="truncate">{money0(p.amount)}</span></div>
                    ))}
                    {bucket?.todos.slice(0, 2).map((t) => (
                      <div key={t.id} title={t.task} className={`flex items-center gap-1 truncate rounded px-1 text-[10px] ${t.done ? "text-faint line-through" : "bg-surface-2 text-muted"}`}><span className="flex-none">○</span><span className="truncate">{t.task}</span></div>
                    ))}
                    {n > 4 && <div className="px-1 text-[10px] text-faint">+{n - 4} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-faint">
            <span><span className="text-accent">●</span> Payment</span>
            <span>○ To-do</span>
            <span>💍 Wedding day</span>
          </div>
        </section>

        {/* SIDEBAR */}
        <aside className="space-y-5">
          {(sug.payments.length > 0 || sug.tasks.length > 0) && (
            <div className="rounded-2xl border border-accent/30 bg-accent-weak/25 p-4">
              <h3 className="mb-2 text-sm font-semibold">Suggestions</h3>
              {sug.payments.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">From your contracts</p>
                  <div className="space-y-1">
                    {sug.payments.map((s) => (
                      <button key={s.source_document_id + s.source_item_key} onClick={() => acceptPayment(s)} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-left text-xs hover:border-accent">
                        <span className="flex-none font-bold text-accent">＋</span>
                        <span className="min-w-0 flex-1 truncate">{s.label}</span>
                        <span className="flex-none tabular-nums text-muted">{money0(s.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sug.tasks.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">Commonly missed to-dos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sug.tasks.map((s) => (
                      <button key={s.task} onClick={() => acceptTask(s)} className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] hover:border-accent"><span className="font-bold text-accent">＋</span> {s.task}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Payment plan</h3>
              <span className="text-xs text-muted">{money0(dueTotal)} due · <span className="text-good">{money0(paidTotal)} paid</span></span>
            </div>
            <div className="space-y-1.5">
              {sortedPays.map((p) => (
                <div key={p.id} className="group rounded-lg border border-line p-2.5">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={p.paid} onChange={(e) => patchPay(p.id, { paid: e.target.checked })} className="h-4 w-4 flex-none accent-[var(--accent)]" />
                    <TextField value={p.label} onSet={(v) => patchPay(p.id, { label: v })} className={`min-w-0 flex-1 text-sm font-medium ${p.paid ? "text-faint line-through" : ""}`} placeholder="Payment" />
                    <NumField value={p.amount} onSet={(n) => patchPay(p.id, { amount: n })} />
                    <button onClick={() => delPay(p.id)} className="flex-none text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad">×</button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <DateControl when={payWhen(p)} dueDate={p.due_date} eventDate={ev}
                      onDate={(iso) => patchPay(p.id, { due_date: iso, due_rule: null })}
                      onRule={(rule) => patchPay(p.id, { due_rule: rule, due_date: null })}
                      onClear={() => patchPay(p.id, { due_date: null, due_rule: null })} />
                    <select value={p.vendor_id ?? ""} onChange={(e) => patchPay(p.id, { vendor_id: e.target.value || null })} className="max-w-[120px] rounded-md border border-line bg-surface px-1 py-1 text-xs text-muted">
                      <option value="">no vendor</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={addPay} className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add payment</button>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">To-dos</h3>
              <span className="text-xs text-muted">{todos.filter((t) => !t.done).length} open</span>
            </div>
            <div className="space-y-1.5">
              {sortedTasks.map((t) => (
                <div key={t.id} className="group rounded-lg border border-line p-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={t.done} onChange={(e) => patchTask(t.id, { done: e.target.checked })} className="h-4 w-4 flex-none accent-[var(--accent)]" />
                    <TextField value={t.task} onSet={(v) => patchTask(t.id, { task: v })} className={`min-w-0 flex-1 text-sm ${t.done ? "text-faint line-through" : ""}`} placeholder="To-do" />
                    <button onClick={() => delTask(t.id)} className="flex-none text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad">×</button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <DateControl when={taskWhen(t)} dueDate={t.due_date} eventDate={ev} compact
                      onDate={(iso) => patchTask(t.id, { due_date: iso, due_rule: null })}
                      onRule={(rule) => patchTask(t.id, { due_rule: rule, due_date: null })}
                      onClear={() => patchTask(t.id, { due_date: null, due_rule: null })} />
                    <select value={t.vendor_id ?? ""} onChange={(e) => patchTask(t.id, { vendor_id: e.target.value || null })} className="max-w-[120px] rounded-md border border-line bg-surface px-1 py-1 text-xs text-muted">
                      <option value="">no vendor</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={addTask} className="w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:text-ink">+ Add to-do</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// One control for "when": shows a clear date/label; opens a popover to pick an
// exact date or a relative-to-the-wedding rule.
function DateControl({ when, dueDate, eventDate, compact, onDate, onRule, onClear }: {
  when: { date: string | null; label: string }; dueDate: string | null; eventDate: string; compact?: boolean;
  onDate: (iso: string | null) => void; onRule: (rule: DueRule) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const scheduled = when.date || dueDate;
  const text = dueDate ? fmtHuman(dueDate) : when.date ? when.label : when.label !== "Unscheduled" ? when.label : "Set date";
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${scheduled ? "border-line text-ink" : "border-dashed border-line text-faint"} hover:border-accent`}>
        📅 <span className={compact ? "max-w-[110px] truncate" : ""}>{text}</span>
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-line bg-surface p-3 shadow-lg">
            <label className="block text-[11px] text-muted">Exact date
              <input type="date" value={dueDate ?? ""} onChange={(e) => { onDate(e.target.value || null); setOpen(false); }} className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-sm" />
            </label>
            <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Relative to the wedding</p>
            <div className="flex flex-wrap gap-1">
              {RULE_PRESETS.map((r) => (
                <button key={r.label} onClick={() => { onRule(r.rule); setOpen(false); }} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:border-accent hover:text-ink">{r.label}</button>
              ))}
            </div>
            {scheduled && <button onClick={() => { onClear(); setOpen(false); }} className="mt-3 text-[11px] text-faint hover:text-bad">Clear date</button>}
          </div>
        </>
      )}
    </div>
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

function NumField({ value, onSet }: { value: number; onSet: (n: number) => void }) {
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
        className="w-14 bg-transparent text-right outline-none" />
    </span>
  );
}
