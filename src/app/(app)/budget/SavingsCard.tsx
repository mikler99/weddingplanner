"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { money, money0 } from "@/lib/format";
import type { Gift } from "@/lib/budget-data";
import * as actions from "./actions";

const SAVE_MS = 600;

// Editable savings plan (rehomed here after the category rebuild dropped it).
// Recomputes on-track live from the passed expense + months; persists inputs.
export function SavingsCard({
  weddingId, expense, months, saved: saved0, monthly: monthly0, gifts: gifts0,
}: {
  weddingId: string; expense: number; months: number; saved: number; monthly: number; gifts: Gift[];
}) {
  const [saved, setSaved] = useState(saved0);
  const [monthly] = useState(monthly0); // = your budget capacity; edited in /savings
  const [gifts, setGifts] = useState<Gift[]>(gifts0);
  const [err, setErr] = useState<string | null>(null);

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const schedule = useCallback((key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.set(key, setTimeout(async () => {
      const r = await fn();
      setErr(r.ok ? null : r.error ?? "Save failed");
    }, SAVE_MS));
  }, []);

  const { available, needed, onTrack, balance, giftsTotal } = useMemo(() => {
    const giftsTotal = gifts.reduce((n, g) => n + g.amount, 0);
    const available = saved + monthly * months + giftsTotal;
    const needed = months > 0 ? Math.max(0, (expense - saved - giftsTotal) / months) : 0;
    return { available, needed, onTrack: monthly >= needed, balance: available - expense, giftsTotal };
  }, [saved, monthly, gifts, expense, months]);

  const changeSaved = (n: number) => { setSaved(n); schedule("saved", () => actions.updateConfig(weddingId, { saved: n })); };
  const changeGift = (id: string, patch: Partial<Gift>) => {
    setGifts((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    schedule(`gift:${id}`, () => actions.updateGift(id, patch));
  };
  const addGift = async () => {
    const res = await actions.addGift(weddingId);
    if (res.ok && res.id) setGifts((gs) => [...gs, { id: res.id!, label: "Gift", amount: 0, sort: gs.length }]);
    else if (!res.ok) setErr(res.error);
  };
  const removeGift = async (id: string) => { setGifts((gs) => gs.filter((g) => g.id !== id)); const res = await actions.deleteGift(id); if (!res.ok) setErr(res.error); };

  return (
    <div className={`rounded-2xl border p-6 ${onTrack ? "border-good/30 bg-good/10" : "border-warn/30 bg-warn/10"}`}>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Savings plan</p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${onTrack ? "bg-good/20 text-good" : "bg-warn/20 text-warn"}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: onTrack ? "var(--good)" : "var(--warn)" }} />
          {onTrack ? "On track" : "Behind plan"}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{money0(needed)}<span className="text-sm font-medium text-muted">/mo needed</span></p>
      <p className="text-xs text-muted">across {months} months · {money0(available)} available · balance {money0(balance)}</p>

      <div className="mt-4 flex flex-col gap-2 border-t border-line/60 pt-3 text-sm">
        <Field label="Banked so far"><Num value={saved} onChange={changeSaved} /></Field>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-muted">Saving / month</span>
          <span className="tabular-nums font-medium">{money0(monthly)}</span>
        </div>
        <a href="/savings" className="-mt-1 self-start text-xs text-accent hover:underline">Set income & expenses in Budget & savings →</a>
        {gifts.map((g) => (
          <div key={g.id} className="flex items-center gap-2">
            <input defaultValue={g.label} onChange={(e) => changeGift(g.id, { label: e.target.value })} className="min-w-0 flex-1 rounded-md border border-transparent px-1 py-0.5 hover:border-line focus:border-accent" />
            <span className="text-faint">$</span><Num value={g.amount} onChange={(v) => changeGift(g.id, { amount: v })} narrow />
            <button onClick={() => removeGift(g.id)} className="text-faint hover:text-bad" aria-label="Remove gift">×</button>
          </div>
        ))}
        <button onClick={addGift} className="self-start text-xs font-medium text-accent hover:underline">+ Add gift / contribution</button>
      </div>
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center gap-2"><span className="flex-1 text-muted">{label}</span><span className="text-faint">$</span>{children}</div>;
}

function Num({ value, onChange, narrow }: { value: number; onChange: (n: number) => void; narrow?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <input inputMode="decimal" value={draft}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; setDraft(String(value)); }}
      onChange={(e) => { const s = e.target.value; setDraft(s); const n = parseFloat(s); if (!Number.isNaN(n) && n >= 0) onChange(n); }}
      className={`${narrow ? "w-16" : "w-24"} rounded-md border border-line bg-surface px-2 py-1 text-right text-sm`} />
  );
}
