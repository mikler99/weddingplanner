"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Proposal } from "@/lib/extract";
import { resolveDue, type DueRule } from "@/lib/payments";
import { applyExtraction } from "../actions";

type Props = {
  extractionId: string;
  weddingId: string;
  documentId: string;
  proposal: Proposal;
  eventDate: string;
  alreadyApplied: boolean;
};

export function ReviewClient({ extractionId, weddingId, documentId, proposal, eventDate, alreadyApplied }: Props) {
  const router = useRouter();
  const [p, setP] = useState<Proposal>(proposal);
  const [inc, setInc] = useState({
    venue_costs: proposal.venue_costs.map(() => true),
    caterers: proposal.caterers.map(() => true),
    budget_lines: proposal.budget_lines.map(() => true),
    payments: proposal.payments.map(() => true),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyApplied);

  const total =
    (["venue_costs", "caterers", "budget_lines", "payments"] as const).reduce(
      (n, k) => n + inc[k].filter(Boolean).length,
      0
    );

  const setField = <K extends keyof Proposal>(key: K, i: number, patch: object) =>
    setP((prev) => ({
      ...prev,
      [key]: (prev[key] as object[]).map((r, j) => (i === j ? { ...r, ...patch } : r)),
    }));
  const toggle = (key: keyof typeof inc, i: number) =>
    setInc((prev) => ({ ...prev, [key]: prev[key].map((v, j) => (i === j ? !v : v)) }));

  async function apply() {
    setBusy(true);
    setErr(null);
    const res = await applyExtraction({ extractionId, weddingId, documentId, proposal: p, include: inc });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    } else setErr(res.error);
  }

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  return (
    <div className="flex flex-col gap-6">
      {done && (
        <p className="rounded-md bg-good/10 px-3 py-2 text-sm text-good">
          Added to your options — nothing&apos;s committed yet.{" "}
          <button onClick={() => router.push("/budget")} className="font-medium underline">
            Pick them in the budget →
          </button>{" "}
          Select which ones a scenario uses; edit here and re-add to refresh.
        </p>
      )}
      {err && <p className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      <Group title="Venue & bar" empty={p.venue_costs.length === 0}>
        {p.venue_costs.map((r, i) => (
          <Line key={i} checked={inc.venue_costs[i]} onToggle={() => toggle("venue_costs", i)}>
            <Text value={r.label} onChange={(v) => setField("venue_costs", i, { label: v })} />
            <Amount value={r.amount} onChange={(v) => setField("venue_costs", i, { amount: num(v) })} />
          </Line>
        ))}
      </Group>

      <Group title="Caterers" empty={p.caterers.length === 0}>
        {p.caterers.map((r, i) => (
          <Line key={i} checked={inc.caterers[i]} onToggle={() => toggle("caterers", i)}>
            <Text value={r.package} onChange={(v) => setField("caterers", i, { package: v })} />
            <span className="text-faint">$</span>
            <Amount value={r.price_pp} onChange={(v) => setField("caterers", i, { price_pp: num(v) })} narrow />
            <span className="text-xs text-faint">/pp</span>
          </Line>
        ))}
      </Group>

      <Group title="Everything else" empty={p.budget_lines.length === 0}>
        {p.budget_lines.map((r, i) => (
          <Line key={i} checked={inc.budget_lines[i]} onToggle={() => toggle("budget_lines", i)}>
            <Text value={r.label} onChange={(v) => setField("budget_lines", i, { label: v })} />
            <Amount value={r.amount} onChange={(v) => setField("budget_lines", i, { amount: num(v) })} />
          </Line>
        ))}
      </Group>

      <Group title="Payments" empty={p.payments.length === 0}>
        {p.payments.map((r, i) => (
          <Line key={i} checked={inc.payments[i]} onToggle={() => toggle("payments", i)}>
            <Text value={r.label} onChange={(v) => setField("payments", i, { label: v })} />
            <span className="whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-xs text-muted" title="Due date is derived from your wedding date">
              {resolveDue(r.due as DueRule, null, eventDate).label}
            </span>
            <Amount value={r.amount} onChange={(v) => setField("payments", i, { amount: num(v) })} />
          </Line>
        ))}
      </Group>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <p className="text-sm text-muted">{total} item{total === 1 ? "" : "s"} selected</p>
        <button
          onClick={apply}
          disabled={busy || total === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-50"
        >
          {busy ? "Adding…" : done ? "Re-add options" : "Add to options"}
        </button>
      </div>
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {empty ? <p className="text-sm text-faint">Nothing found.</p> : <div className="flex flex-col gap-2">{children}</div>}
    </section>
  );
}

function Line({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${checked ? "" : "opacity-40"}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {children}
    </div>
  );
}

function Text({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-md border border-transparent px-1 py-1 hover:border-line focus:border-line"
    />
  );
}

function Amount({ value, onChange, narrow }: { value: number; onChange: (v: string) => void; narrow?: boolean }) {
  return (
    <input
      inputMode="decimal"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className={`${narrow ? "w-16" : "w-24"} rounded-md border border-line px-2 py-1 text-right`}
    />
  );
}
