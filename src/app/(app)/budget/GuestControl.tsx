"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGuestEstimate } from "./actions";
import { setScenarioGuests } from "../scenarios/actions";

// Guest count for the scenario you're editing. For the active plan this is the
// wedding's count; for a non-active scenario it's that scenario's own headcount.
export function GuestControl({
  weddingId, initial, scenarioId, isActive,
}: {
  weddingId: string; initial: number; scenarioId: string; isActive: boolean;
}) {
  const [g, setG] = useState(initial);
  const router = useRouter();
  const [pending, start] = useTransition();

  const commit = (n: number) => {
    const v = Math.max(0, n);
    setG(v);
    start(async () => {
      if (isActive) await setGuestEstimate(weddingId, v);
      else await setScenarioGuests(scenarioId, v, false, weddingId);
      router.refresh();
    });
  };

  return (
    <div className={`flex items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
      <span className="mr-1 text-xs font-medium text-muted">Guests</span>
      <button onClick={() => commit(g - 1)} className="h-7 w-7 rounded-md border border-line text-lg leading-none text-muted hover:bg-surface-2" aria-label="Fewer guests">−</button>
      <input type="number" value={g} onChange={(e) => commit(parseInt(e.target.value || "0", 10))} className="w-16 rounded-md border border-line px-2 py-1 text-center text-sm tabular-nums" />
      <button onClick={() => commit(g + 1)} className="h-7 w-7 rounded-md border border-line text-lg leading-none text-muted hover:bg-surface-2" aria-label="More guests">+</button>
    </div>
  );
}
