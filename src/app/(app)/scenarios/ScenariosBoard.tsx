"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { money0 } from "@/lib/format";
import type { ScenarioSummary } from "@/lib/scenarios";
import * as actions from "./actions";

export function ScenariosBoard({ weddingId, scenarios }: { weddingId: string; scenarios: ScenarioSummary[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? "Something went wrong"); else { setErr(null); router.refresh(); } });

  const cheapest = scenarios.length > 1 ? Math.min(...scenarios.map((s) => s.total)) : null;
  const active = scenarios.find((s) => s.is_active);

  return (
    <div>
      {err && <p className="mb-4 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => run(() => actions.createScenario(weddingId, "New scenario"))} disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          + New scenario
        </button>
        {active && (
          <button onClick={() => run(() => actions.createScenario(weddingId, `${active.name} (copy)`, active.id))} disabled={pending}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50">
            Clone the plan
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((s) => (
          <Card key={s.id} s={s} weddingId={weddingId} cheapest={cheapest} pending={pending} run={run} />
        ))}
        {scenarios.length === 0 && <p className="text-sm text-faint">No scenarios yet.</p>}
      </div>
    </div>
  );
}

function Card({
  s, weddingId, cheapest, pending, run,
}: {
  s: ScenarioSummary; weddingId: string; cheapest: number | null; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const byCat = new Map<string, { label: string; vendor: string | null; amount: number }[]>();
  for (const p of s.picks) (byCat.get(p.category) ?? byCat.set(p.category, []).get(p.category)!).push(p);
  const isCheapest = cheapest != null && s.total === cheapest;

  return (
    <div className={`flex flex-col rounded-2xl border bg-surface p-5 ${s.is_active ? "border-accent shadow-md" : "border-line"}`}>
      <div className="flex items-start justify-between gap-2">
        <input
          defaultValue={s.name}
          onBlur={(e) => e.target.value.trim() !== s.name && run(() => actions.renameScenario(s.id, e.target.value))}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-lg font-semibold hover:border-line focus:border-accent"
        />
        {s.is_active ? (
          <span className="flex-none rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">The plan</span>
        ) : (
          <button onClick={() => run(() => actions.activateScenario(weddingId, s.id))} disabled={pending}
            className="flex-none rounded-full border border-accent px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent-weak disabled:opacity-50">
            Make the plan
          </button>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold tabular-nums">{money0(s.total)}</div>
          {isCheapest && cheapest != null && <div className="text-[11px] font-semibold text-good">lowest total</div>}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          guests
          <input type="number" defaultValue={s.guests} min={0}
            onBlur={(e) => Number(e.target.value) !== s.guests && run(() => actions.setScenarioGuests(s.id, parseInt(e.target.value || "0", 10), s.is_active, weddingId))}
            className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-right" />
        </label>
      </div>

      <div className="mt-4 flex-1 border-t border-line pt-3">
        {byCat.size === 0 ? (
          <p className="text-xs text-faint">No options selected yet.</p>
        ) : (
          [...byCat.entries()].map(([cat, picks]) => {
            const vs = new Set(picks.map((p) => p.vendor).filter(Boolean));
            const vendor = vs.size === 1 ? [...vs][0] : null;
            return (
              <div key={cat} className="mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-faint">{cat}{vendor ? <span className="text-muted"> · {vendor}</span> : ""}</p>
                {picks.map((p, i) => (
                  <div key={i} className="flex justify-between text-[13px]">
                    <span className="truncate pr-2 text-muted">{p.label}</span>
                    <span className="tabular-nums">{money0(p.amount)}</span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
        <Link href={s.is_active ? "/budget" : `/budget?scenario=${s.id}`} className="text-accent hover:underline">Edit options →</Link>
        {!s.is_active && (
          <button onClick={() => confirm(`Delete "${s.name}"?`) && run(() => actions.deleteScenario(s.id))} disabled={pending}
            className="text-faint hover:text-bad disabled:opacity-50">Delete</button>
        )}
      </div>
    </div>
  );
}
