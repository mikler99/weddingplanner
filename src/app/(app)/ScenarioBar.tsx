"use client";

import Link from "next/link";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { activateScenario } from "./scenarios/actions";

// Budget-section control: choose which scenario you're viewing/editing (URL
// ?scenario=…), and promote it to "the plan" when ready. Editing a non-active
// scenario is fine — it just doesn't drive the hub until you make it the plan.
export function ScenarioBar({
  weddingId, scenarios, viewedId, isActive,
}: {
  weddingId: string; scenarios: { id: string; name: string; is_active: boolean }[]; viewedId: string; isActive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const go = (id: string) => {
    const active = scenarios.find((s) => s.id === id)?.is_active;
    router.push(active ? pathname : `${pathname}?scenario=${id}`);
  };
  const makePlan = () => start(async () => { await activateScenario(weddingId, viewedId); router.push(pathname); router.refresh(); });

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm ${pending ? "opacity-60" : ""}`}>
      <span className="text-xs font-medium text-faint">Editing</span>
      <select value={viewedId} onChange={(e) => go(e.target.value)} className="max-w-[11rem] cursor-pointer truncate bg-transparent font-semibold text-ink focus:outline-none" aria-label="Scenario to edit">
        {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (the plan)" : ""}</option>)}
      </select>
      {isActive ? (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">the plan</span>
      ) : (
        <button onClick={makePlan} disabled={pending} className="rounded-full border border-accent px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent-weak disabled:opacity-50">
          Make this the plan
        </button>
      )}
      <Link href="/scenarios" className="text-xs text-accent hover:underline">compare</Link>
    </div>
  );
}
