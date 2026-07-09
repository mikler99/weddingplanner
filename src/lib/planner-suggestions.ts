import { createClient } from "@/lib/supabase/server";
import { slug } from "@/lib/slug";
import { STARTER_TODOS } from "@/lib/planner-templates";
import type { DueRule } from "@/lib/payments";

// What the planner can suggest adding to a scenario: payments the couple's
// contracts list but that aren't in this plan (e.g. deleted), and standard
// wedding to-dos they haven't added yet.

export type TaskSuggestion = { task: string; rule: DueRule };
export type PaymentSuggestion = {
  label: string;
  amount: number;
  due_date: string | null;
  due_rule: DueRule | null;
  source_document_id: string;
  source_item_key: string;
  vendor_id: string | null;
  docLabel: string;
};
export type Suggestions = { payments: PaymentSuggestion[]; tasks: TaskSuggestion[] };

const STOP = new Set(["the", "and", "with", "your", "for", "from", "book", "order", "plan", "send", "give", "buy", "confirm", "final"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

type ExtractionPayment = { label: string; amount: number; due?: { kind: DueRule["kind"]; value: number | null; unit: DueRule["unit"]; date: string | null } };

export async function loadSuggestions(weddingId: string, scenarioId: string): Promise<Suggestions> {
  const supabase = await createClient();
  const docsRes = await supabase.from("documents").select("id, label, vendor_id").eq("wedding_id", weddingId);
  const docs = docsRes.data ?? [];
  const docIds = docs.map((d) => d.id);
  const docById = new Map(docs.map((d) => [d.id, d]));

  const [exRes, payRes, taskRes] = await Promise.all([
    docIds.length ? supabase.from("document_extractions").select("document_id, data, created_at").in("document_id", docIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as { document_id: string; data: unknown; created_at: string }[] }),
    supabase.from("payments").select("source_document_id, source_item_key").eq("scenario_id", scenarioId),
    supabase.from("milestones").select("task").eq("scenario_id", scenarioId),
  ]);

  const have = new Set((payRes.data ?? []).filter((p) => p.source_document_id).map((p) => `${p.source_document_id}::${p.source_item_key}`));

  // Latest extraction per document.
  const latest = new Map<string, unknown>();
  for (const e of exRes.data ?? []) if (!latest.has(e.document_id)) latest.set(e.document_id, e.data);

  const payments: PaymentSuggestion[] = [];
  const seen = new Set<string>();
  for (const [docId, data] of latest) {
    const list = ((data as { payments?: ExtractionPayment[] })?.payments ?? []);
    for (const p of list) {
      const key = slug(p.label);
      const uid = `${docId}::${key}`;
      if (have.has(uid) || seen.has(uid)) continue;
      seen.add(uid);
      const due = p.due;
      payments.push({
        label: p.label,
        amount: p.amount ?? 0,
        due_date: due?.kind === "absolute" ? due.date : null,
        due_rule: !due || due.kind === "unknown" ? null : { kind: due.kind, value: due.value, unit: due.unit, date: due.date },
        source_document_id: docId,
        source_item_key: key,
        vendor_id: docById.get(docId)?.vendor_id ?? null,
        docLabel: docById.get(docId)?.label ?? "Contract",
      });
    }
  }

  // Standard to-dos not already covered by an existing task (loose token overlap).
  const existing = (taskRes.data ?? []).map((t) => tokens(t.task));
  const tasks: TaskSuggestion[] = STARTER_TODOS.filter((t) => {
    const tt = tokens(t.task);
    return !existing.some((et) => tt.filter((w) => et.includes(w)).length >= 1);
  }).map((t) => ({ task: t.task, rule: t.rule }));

  return { payments, tasks };
}
