"use client";

import { useState } from "react";
import { money0 } from "@/lib/format";
import { togglePayment, toggleMilestone } from "./home-actions";

export type ChecklistItem = { id: string; label: string; meta?: string | null; amount?: number; done: boolean };

// Two-way hub checklist: toggling checks/unchecks (both directions) and
// persists, keeping the item visible so a misclick is instantly reversible.
export function Checklist({ kind, items, empty }: { kind: "payment" | "task"; items: ChecklistItem[]; empty: string }) {
  const [state, setState] = useState(items);
  const persist = kind === "payment" ? togglePayment : toggleMilestone;

  const toggle = (id: string, next: boolean) => {
    setState((s) => s.map((i) => (i.id === id ? { ...i, done: next } : i)));
    persist(id, next);
  };

  if (state.length === 0) return <p className="text-sm text-faint">{empty}</p>;

  return (
    <div className="flex flex-col gap-1.5">
      {state.map((i) => (
        <label key={i.id} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={i.done}
            onChange={(e) => toggle(i.id, e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className={`flex-1 ${i.done ? "text-faint line-through" : ""}`}>{i.label}</span>
          {i.meta && <span className="text-xs text-faint">{i.meta}</span>}
          {i.amount != null && <span className="tabular-nums">{money0(i.amount)}</span>}
        </label>
      ))}
    </div>
  );
}
