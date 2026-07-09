"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { money0 } from "@/lib/format";
import { VENDOR_STATUSES, type VendorCard } from "@/lib/vendors-core";
import * as actions from "./actions";

const STATUS_STYLE: Record<string, string> = {
  Booked: "text-good border-good/40 bg-good/10",
  Considering: "text-muted border-line bg-surface-2",
  Passed: "text-faint border-line bg-surface-2",
};

export function VendorsClient({ weddingId, vendors }: { weddingId: string; vendors: VendorCard[] }) {
  const [rows, setRows] = useState<VendorCard[]>(vendors);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setRows(vendors), [vendors]);

  const patch = (id: string, p: Partial<VendorCard>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    actions.updateVendor(id, p).then((res) => { if (!res.ok) setErr(res.error); });
  };
  const add = () =>
    start(async () => {
      const res = await actions.addVendor(weddingId);
      if (res.ok && res.id) { const id = res.id; setRows((rs) => [{ id, wedding_id: weddingId, name: "New vendor", category: null, contact: null, email: null, phone: null, website: null, notes: null, next_step: null, status: "Considering", sort: 0, categories: [], optionCount: 0, inPlanCount: 0, planCost: 0, docCount: 0, scenarioNames: [] }, ...rs]); setOpen(id); }
      else if (!res.ok) setErr(res.error);
    });
  const remove = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); actions.deleteVendor(id).then((res) => { if (!res.ok) setErr(res.error); }); };

  const order = ["Booked", "Considering", "Passed"];
  const groups = order.map((st) => ({ st, items: rows.filter((r) => r.status === st) }));
  const other = rows.filter((r) => !order.includes(r.status));
  if (other.length) groups.push({ st: "Other", items: other });

  return (
    <div>
      {err && <p className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
      <button onClick={add} className="mb-5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90">+ Add vendor</button>

      {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-faint">No vendors yet. Suppliers appear here as you add options and documents.</p>}

      {groups.map(({ st, items }) =>
        items.length === 0 ? null : (
          <section key={st} className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{st} <span className="text-muted">({items.length})</span></p>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((v) => (
                <VendorCardView key={v.id} v={v} isOpen={open === v.id} onToggle={() => setOpen((o) => (o === v.id ? null : v.id))} patch={(p) => patch(v.id, p)} onRemove={() => remove(v.id)} />
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}

function VendorCardView({ v, isOpen, onToggle, patch, onRemove }: { v: VendorCard; isOpen: boolean; onToggle: () => void; patch: (p: Partial<VendorCard>) => void; onRemove: () => void }) {
  const statusOpts = VENDOR_STATUSES.includes(v.status as (typeof VENDOR_STATUSES)[number]) ? VENDOR_STATUSES : [v.status, ...VENDOR_STATUSES];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <TextField value={v.name ?? ""} onSet={(val) => patch({ name: val || null })} placeholder="Vendor name" className="w-full font-display text-lg font-semibold" />
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-faint">
            {v.categories.length ? v.categories.map((c) => <span key={c} className="rounded-full border border-line px-1.5 py-0.5">{c}</span>) : v.category && <span className="rounded-full border border-line px-1.5 py-0.5">{v.category}</span>}
          </div>
        </div>
        <select value={v.status} onChange={(e) => patch({ status: e.target.value })} className={`flex-none rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_STYLE[v.status] ?? "border-line text-muted"}`}>
          {statusOpts.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="In plan" value={v.inPlanCount ? money0(v.planCost) : "—"} sub={v.optionCount ? `${v.inPlanCount}/${v.optionCount} options` : "no options"} />
        <Stat label="Docs" value={String(v.docCount)} sub={v.docCount === 1 ? "contract" : "contracts"} />
        <Stat label="Scenarios" value={String(v.scenarioNames.length)} sub={v.scenarioNames[0] ? v.scenarioNames.join(", ") : "unused"} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <button onClick={onToggle} className="text-accent hover:underline">{isOpen ? "Hide details" : "Contact & notes"}</button>
        <button onClick={() => confirm(`Remove "${v.name ?? "this vendor"}"? Options/docs stay but unlink.`) && onRemove()} className="text-faint hover:text-bad">Remove</button>
      </div>

      {isOpen && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Labeled label="Category"><TextField value={v.category ?? ""} onSet={(val) => patch({ category: val || null })} placeholder="—" className="w-full" small /></Labeled>
            <Labeled label="Contact"><TextField value={v.contact ?? ""} onSet={(val) => patch({ contact: val || null })} placeholder="Name" className="w-full" small /></Labeled>
            <Labeled label="Email"><TextField value={v.email ?? ""} onSet={(val) => patch({ email: val || null })} placeholder="email@…" className="w-full" small /></Labeled>
            <Labeled label="Phone"><TextField value={v.phone ?? ""} onSet={(val) => patch({ phone: val || null })} placeholder="—" className="w-full" small /></Labeled>
          </div>
          <Labeled label="Website"><TextField value={v.website ?? ""} onSet={(val) => patch({ website: val || null })} placeholder="https://…" className="w-full" small /></Labeled>
          <Labeled label="Next step"><TextField value={v.next_step ?? ""} onSet={(val) => patch({ next_step: val || null })} placeholder="e.g. sign contract" className="w-full" small /></Labeled>
          <Labeled label="Notes"><textarea value={v.notes ?? ""} onChange={(e) => patch({ notes: e.target.value || null })} rows={2} className="w-full resize-y rounded-md border border-line bg-surface px-2 py-1 text-sm" /></Labeled>
          <div className="mt-1 flex gap-3 text-xs">
            <Link href="/documents" className="text-accent hover:underline">Documents →</Link>
            <Link href="/budget" className="text-accent hover:underline">Options in Budget →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[10px] text-faint" title={sub}>{sub}</p>
    </div>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-1.5 block"><span className="mb-0.5 block text-[11px] text-muted">{label}</span>{children}</label>;
}

function TextField({ value, onSet, placeholder, className = "", small }: { value: string; onSet: (v: string) => void; placeholder?: string; className?: string; small?: boolean }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => { focused.current = false; if (draft !== value) onSet(draft); }}
      onChange={(e) => setDraft(e.target.value)}
      className={`${className} rounded-md border ${small ? "border-line bg-surface px-2 py-1 text-sm" : "border-transparent bg-transparent px-1 py-0.5 hover:border-line focus:border-accent"}`}
    />
  );
}
