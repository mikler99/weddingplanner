"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeBudget, type BudgetItem } from "@/lib/budget";
import { money, money0 } from "@/lib/format";
import type { CategoryView } from "@/lib/categories";
import * as actions from "../actions";
import { toggleScenarioItem } from "../../scenarios/actions";
import { ScenarioBar } from "../../ScenarioBar";

const SAVE_MS = 600;

export function CategoryClient({ view }: { view: CategoryView }) {
  const router = useRouter();
  const weddingId = view.wedding.id;
  const c = view.category;
  const sid = view.scenarioId;
  const q = view.isActive ? "" : `?scenario=${view.scenarioId}`; // keep editing this scenario across tabs
  const [guests, setGuests] = useState(view.guests);
  const [items, setItems] = useState<BudgetItem[]>(view.items); // pool for this category
  const [selected, setSelected] = useState<Set<string>>(new Set(view.selectedIds));
  const [err, setErr] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dirty = useRef(new Set<string>());
  const schedule = useCallback((key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    dirty.current.add(key);
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.set(key, setTimeout(async () => {
      timers.current.delete(key);
      try { const r = await fn(); setErr(r.ok ? null : r.error ?? "Save failed"); } finally { dirty.current.delete(key); }
    }, SAVE_MS));
  }, []);

  // Realtime: pool field edits + selection changes (both partners stay in sync).
  useEffect(() => {
    const supabase = createClient();
    const clean = (k: string) => !dirty.current.has(k);
    const ch = supabase.channel(`cat:${weddingId}:${c.slug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "weddings", filter: `id=eq.${weddingId}` },
        (p) => { if (clean("guests")) setGuests((p.new as { guest_estimate: number }).guest_estimate); })
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items", filter: `wedding_id=eq.${weddingId}` }, (p) => {
        if (p.eventType === "DELETE") { setItems((its) => its.filter((i) => i.id !== (p.old as BudgetItem).id)); return; }
        const row = p.new as BudgetItem;
        if (!clean(`item:${row.id}`)) return;
        setItems((its) => {
          const mine = row.category === c.name;
          const idx = its.findIndex((i) => i.id === row.id);
          if (!mine) return idx === -1 ? its : its.filter((i) => i.id !== row.id);
          if (idx === -1) return [...its, row];
          const next = [...its]; next[idx] = row; return next;
        });
      });
    if (sid) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "scenario_items", filter: `scenario_id=eq.${sid}` }, (p) => {
        const row = (p.eventType === "DELETE" ? p.old : p.new) as { item_id: string };
        if (dirty.current.has(`sel:${row.item_id}`)) return;
        setSelected((s) => { const n = new Set(s); if (p.eventType === "DELETE") n.delete(row.item_id); else n.add(row.item_id); return n; });
      });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [weddingId, c.slug, c.name, sid]);

  // Category subtotal = the SELECTED options in this category, live.
  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const r = useMemo(
    () => computeBudget({ guests, taxRate: view.taxRate, items: selectedItems, saved: 0, monthly: 0, gifts: [], eventDate: view.wedding.event_date }),
    [guests, view.taxRate, selectedItems, view.wedding.event_date]
  );
  const share = view.result.expense > 0 ? Math.round((r.expense / view.result.expense) * 100) : 0;

  // What's IN this scenario vs available to add from the library (grouped by quote).
  const selectedList = useMemo(() => items.filter((i) => selected.has(i.id)).sort((a, b) => a.sort - b.sort), [items, selected]);
  const available = useMemo(() => items.filter((i) => !selected.has(i.id)).sort((a, b) => a.sort - b.sort), [items, selected]);
  const availableByDoc = useMemo(() => {
    const m = new Map<string, BudgetItem[]>();
    for (const it of available) {
      const key = it.source_document_id ? view.docLabels[it.source_document_id] ?? "Document" : "Added manually";
      (m.get(key) ?? m.set(key, []).get(key)!).push(it);
    }
    return [...m.entries()];
  }, [available, view.docLabels]);

  // Supplier at the category level: the common vendor of the selected options.
  const catVendor = useMemo(() => {
    const vs = new Set(selectedList.map((i) => i.vendor).filter(Boolean));
    return vs.size === 1 ? (([...vs][0] as string)) : "";
  }, [selectedList]);
  const applyCatVendor = (v: string) => {
    const ids = selectedList.map((i) => i.id);
    setItems((its) => its.map((it) => (ids.includes(it.id) ? { ...it, vendor: v || null } : it)));
    ids.forEach((id) => dirty.current.add(`item:${id}`));
    (async () => { const res = await actions.setCategoryVendor(ids, v || null); if (!res.ok) setErr(res.error ?? "Couldn't set supplier"); ids.forEach((id) => dirty.current.delete(`item:${id}`)); })();
  };

  const num = (v: string) => { const n = parseFloat(v); return Number.isNaN(n) || n < 0 ? 0 : n; };
  const changeGuests = (n: number) => { setGuests(n); schedule("guests", () => actions.setGuestEstimate(weddingId, n)); };
  const patchItem = (id: string, patch: Partial<BudgetItem>) => {
    setItems((its) => its.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    schedule(`item:${id}`, () => actions.updateItem(id, patch));
  };

  // Selection into the active plan.
  const setSel = (id: string, on: boolean, siblings: string[] = []) => {
    if (!sid) { setErr("No active plan — pick one in Scenarios."); return; }
    setSelected((s) => {
      const n = new Set(s);
      siblings.forEach((x) => n.delete(x));
      if (on) n.add(id); else n.delete(id);
      return n;
    });
    dirty.current.add(`sel:${id}`);
    (async () => { const res = await toggleScenarioItem(sid, id, on); if (!res.ok) setErr(res.error ?? "Couldn't update the plan"); dirty.current.delete(`sel:${id}`); })();
  };
  // Pull a library option into this scenario (a pick-one group swaps its sibling out).
  const addToScenario = (it: BudgetItem) => {
    const sibs = it.group_key ? items.filter((i) => i.group_key === it.group_key && i.id !== it.id).map((i) => i.id) : [];
    setSel(it.id, true, sibs);
  };

  const addItem = async () => {
    const res = await actions.addItem(weddingId, c.name);
    if (res.ok && res.id) {
      const nid = res.id;
      setItems((its) => [...its, { id: nid, category: c.name, label: "New item", cost_type: "flat", amount: 0, taxable: true, service_pct: 0, refundable: false, active: true, group_key: null, sort: its.length + 100 }]);
      setSel(nid, true); // new custom items go straight into the plan
    } else if (!res.ok) setErr(res.error);
  };
  const removeItem = async (id: string) => {
    setItems((its) => its.filter((i) => i.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    const res = await actions.deleteItem(id);
    if (!res.ok) setErr(res.error);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/budget${q}`} className="text-sm text-muted hover:underline">← Budget</Link>
        <ScenarioBar weddingId={weddingId} scenarios={view.scenarios} viewedId={view.scenarioId} isActive={view.isActive} />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto py-2" style={{ scrollbarWidth: "none" }}>
        {view.categories.map((t) => {
          const on = t.slug === c.slug;
          return (
            <Link key={t.id} href={`/budget/${t.slug}${q}`}
              className="flex flex-none items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition"
              style={on ? { borderColor: `color-mix(in srgb, ${t.color} 55%, var(--line))`, background: `color-mix(in srgb, ${t.color} 9%, var(--surface))`, color: "var(--ink)" }
                       : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}
            </Link>
          );
        })}
      </div>

      <header className="mb-4 mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: c.color }}>{c.name}</h1>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs font-medium text-faint">Supplier</span>
            <CategorySupplier value={catVendor} onSet={applyCatVendor} disabled={selectedList.length === 0} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{r.expense ? money(r.expense) : "—"}</div>
          <div className="text-xs text-muted">{r.expense ? `${share}% of the plan` : "nothing selected"}</div>
        </div>
      </header>

      {err && <p className="mb-3 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4" style={{ ["--c" as string]: c.color } as React.CSSProperties}>
          {/* In this scenario */}
          <section className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">In this scenario</p>
            {selectedList.length === 0 ? (
              <p className="py-2 text-sm text-muted">
                Nothing yet. {available.length > 0 ? "Pull options in from your quotes below" : <>Upload a quote in <Link href="/documents" className="text-accent underline">Documents</Link></>}, or add a custom one.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {selectedList.map((it) => (
                  <ItemRow key={it.id} it={it} guests={guests} categories={view.categories.map((x) => x.name)}
                    source={it.source_document_id && view.docLabels[it.source_document_id] ? { id: it.source_document_id, label: view.docLabels[it.source_document_id] } : null}
                    onPatch={(p) => patchItem(it.id, p)}
                    onMove={async (cat) => { setItems((its) => its.filter((x) => x.id !== it.id)); const res = await actions.moveItem(it.id, cat); if (!res.ok) setErr(res.error ?? "Move failed"); else router.refresh(); }}
                    onRemoveFromScenario={() => setSel(it.id, false)} num={num} accent={c.color} />
                ))}
              </div>
            )}
          </section>

          {/* Add from documents (the library) */}
          <div>
            <button onClick={() => setShowPicker((v) => !v)} className="rounded-lg border border-dashed border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
              {showPicker ? "Hide options" : "＋ Add from documents"} {available.length > 0 && <span className="text-faint">({available.length})</span>}
            </button>
            {showPicker && (
              <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-4">
                {available.length === 0 ? (
                  <p className="text-sm text-faint">No more {c.name.toLowerCase()} options in your library. <Link href="/documents" className="text-accent underline">Upload a quote</Link> to add some.</p>
                ) : (
                  availableByDoc.map(([docName, opts]) => (
                    <div key={docName} className="mb-3 last:mb-0">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-faint">{docName}</p>
                      {opts.map((o) => (
                        <div key={o.id} className="flex items-center gap-2 py-1 text-sm">
                          <span className="flex-1 truncate">{o.label}{o.vendor ? <span className="text-faint"> · {o.vendor}</span> : ""}{o.bundle ? <span className="ml-1 rounded bg-accent-weak px-1 text-[11px] font-medium text-accent">◆ {o.bundle}</span> : o.group_key ? <span className="ml-1 text-xs text-faint">· pick-one</span> : ""}</span>
                          <span className="tabular-nums text-muted">{o.cost_type === "per_guest" ? `${money(o.amount)}/pp` : money(o.amount)}</span>
                          <button onClick={() => addToScenario(o)} className="rounded-md border border-accent px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent-weak">Add</button>
                          <button onClick={() => removeItem(o.id)} title="Delete from library (all scenarios)" className="text-faint hover:text-bad">×</button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button onClick={addItem} className="self-start text-sm font-medium text-accent hover:underline">+ New custom option</button>
        </div>

        {/* Rail */}
        <aside className="rounded-2xl border border-line bg-surface p-5 md:sticky md:top-6 md:self-start">
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-faint">In the plan · {c.name}</h4>
          {r.computed.filter((i) => !i.refundable).length === 0 ? (
            <p className="text-[13px] text-faint">Nothing selected in this category.</p>
          ) : r.computed.filter((i) => !i.refundable).map((i) => (
            <div key={i.id} className="flex justify-between py-1 text-[13px] text-muted">
              <span className="truncate pr-2">{i.label}</span><span className="tabular-nums text-ink">{money0(i.total)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold">
            <span>Category total</span><span className="tabular-nums">{money(r.expense)}</span>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted">Guest count</span>
              <input type="number" value={guests} onChange={(e) => changeGuests(Math.max(0, parseInt(e.target.value || "0", 10)))} className="w-20 rounded-md border border-line px-2 py-1 text-right text-sm" />
            </label>
            <p className="mt-2 text-xs text-faint">Editing options changes <span className="font-medium">{view.scenarioName}</span>{view.isActive ? " (the plan)" : ""}. Switch scenarios above or <Link href="/scenarios" className="text-accent hover:underline">compare</Link>.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ItemRow({
  it, guests, categories, source, onPatch, onMove, onRemoveFromScenario, num, accent,
}: {
  it: BudgetItem; guests: number; categories: string[]; source: { id: string; label: string } | null;
  onPatch: (p: Partial<BudgetItem>) => void; onMove: (cat: string) => void; onRemoveFromScenario: () => void;
  num: (v: string) => number; accent: string;
}) {
  const line = it.cost_type === "per_guest" ? it.amount * guests : it.amount;
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: accent }} title="In this scenario" />
      <input value={it.label} onChange={(e) => onPatch({ label: e.target.value })} className="min-w-[8rem] flex-1 rounded-md border border-transparent px-1 py-1 hover:border-line focus:border-accent" />
      <span className="text-faint">$</span>
      <NumInput value={it.amount} onChange={(v) => onPatch({ amount: v })} className="w-20" />
      <button onClick={() => onPatch({ cost_type: it.cost_type === "flat" ? "per_guest" : "flat" })} className="rounded border border-line px-1.5 py-0.5 text-xs text-muted hover:bg-surface-2" title="Flat or per-guest">
        {it.cost_type === "per_guest" ? "/pp" : "flat"}
      </button>
      <button onClick={() => onPatch({ taxable: !it.taxable })} className={`rounded border px-1.5 py-0.5 text-xs ${it.taxable ? "border-line text-muted" : "border-line text-faint"}`} title="Taxable">tax</button>
      <select value={it.category} onChange={(e) => onMove(e.target.value)} className="max-w-[7rem] rounded border border-line bg-surface px-1 py-0.5 text-xs text-muted" title="Move to category">
        {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      {it.bundle && (
        <span title={`Part of ${it.bundle}`} className="max-w-[8rem] truncate rounded bg-accent-weak px-1.5 py-0.5 text-[11px] font-medium text-accent">◆ {it.bundle}</span>
      )}
      {source && (
        <Link href={`/documents/${source.id}`} title={`From ${source.label}`} className="max-w-[7rem] truncate rounded bg-accent-weak px-1.5 py-0.5 text-[11px] font-medium text-accent hover:underline">▣ {source.label}</Link>
      )}
      <span className="ml-auto w-20 text-right text-xs tabular-nums text-muted" style={{ color: it.cost_type === "per_guest" ? accent : undefined }}>
        {it.cost_type === "per_guest" ? `= ${money(line)}` : ""}
      </span>
      <button onClick={onRemoveFromScenario} className="text-faint hover:text-bad" aria-label="Remove from this scenario" title="Remove from this scenario">×</button>
    </div>
  );
}

// Category-level supplier: shows the common vendor of the selected options and
// stamps whatever you type onto all of them (edited once per category, not per line).
function CategorySupplier({ value, onSet, disabled }: { value: string; onSet: (v: string) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      disabled={disabled}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; if (draft !== value) onSet(draft); }}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={disabled ? "—" : "add a supplier"}
      className="w-48 rounded-md border border-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-line focus:border-accent disabled:text-faint"
    />
  );
}

function NumInput({ value, onChange, className = "w-24" }: { value: number; onChange: (n: number) => void; className?: string }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <input inputMode="decimal" value={draft}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; setDraft(String(value)); }}
      onChange={(e) => { const s = e.target.value; setDraft(s); const n = parseFloat(s); if (!Number.isNaN(n) && n >= 0) onChange(n); }}
      className={`${className} rounded-md border border-line bg-surface px-2 py-1 text-right text-sm`} />
  );
}
