"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioBrief } from "@/lib/scenarios";
import { activateScenario } from "./scenarios/actions";

// "Plan: ‹name› ▾" — shows which scenario is active and switches it. The active
// scenario drives the whole app, so switching re-derives everything.
export function PlanSwitcher({ weddingId, scenarios }: { weddingId: string; scenarios: ScenarioBrief[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = scenarios.find((s) => s.is_active);

  const onChange = (id: string) => {
    if (id === "__manage") { router.push("/scenarios"); return; }
    if (id === active?.id) return;
    start(async () => { await activateScenario(weddingId, id); router.refresh(); });
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm ${pending ? "opacity-60" : ""}`}>
      <span className="text-xs font-medium text-faint">Plan</span>
      <select
        value={active?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[12rem] cursor-pointer truncate bg-transparent font-semibold text-ink focus:outline-none"
        aria-label="Active scenario"
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
        <option value="__manage">＋ Manage scenarios…</option>
      </select>
      <Link href="/scenarios" className="text-xs text-accent hover:underline">compare</Link>
    </div>
  );
}
