import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/wedding";
import { loadScenarios } from "@/lib/scenarios";
import { ScenariosBoard } from "./ScenariosBoard";

export default async function ScenariosPage() {
  const { wedding_id } = await requireMembership();
  const view = await loadScenarios(wedding_id);
  if (!view) notFound();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Scenarios</h1>
        <p className="text-sm text-muted">
          Mixes you&apos;re weighing — different venues, caterers, bar packages, guest counts. Compare the totals, then make one
          &ldquo;the plan&rdquo; to drive your budget, payments, and savings. Pick options for the active plan in each category.
        </p>
      </header>
      <ScenariosBoard weddingId={wedding_id} scenarios={view.scenarios} />
    </main>
  );
}
