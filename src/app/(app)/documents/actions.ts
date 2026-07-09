"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractProposal, ProposalSchema, type Proposal } from "@/lib/extract";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Delete a document + its stored file. Its extraction cascades away; any budget
// items / payments it created are KEPT (their source link just clears) — removing
// a quote shouldn't wipe your budget.
export async function deleteDocument(documentId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", documentId).single();
  if (doc?.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/documents");
  return { ok: true };
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "item";

// Upload → extract. Creates the documents row, runs Claude on the stored file
// server-side (key never leaves the server), and saves the proposal as a DRAFT
// extraction. Writes NOTHING to the budget — that only happens on Apply.
export async function ingestDocument(
  weddingId: string,
  input: { storagePath: string; label: string; mime: string }
): Promise<Result<{ documentId: string; extractionId: string; proposal: Proposal }>> {
  const supabase = await createClient();

  // 1. Record the document (RLS: editor-only).
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      wedding_id: weddingId,
      label: input.label,
      storage_path: input.storagePath,
      mime: input.mime,
      kind: "other",
    })
    .select("id")
    .single();
  if (docErr) return { ok: false, error: docErr.message };

  // 2. Pull the bytes back down (member-read on storage) and encode.
  const { data: blob, error: dlErr } = await supabase.storage
    .from("documents")
    .download(input.storagePath);
  if (dlErr || !blob) return { ok: false, error: dlErr?.message ?? "Download failed" };

  const buf = Buffer.from(await blob.arrayBuffer());
  const isText = input.mime.startsWith("text/");
  const data = isText ? buf.toString("utf8") : buf.toString("base64");

  // 3. Extract (server-side Claude call).
  let proposal: Proposal, model: string;
  try {
    ({ proposal, model } = await extractProposal({ data, mime: input.mime }));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Extraction failed" };
  }

  // Reflect the model's document classification + vendor onto the document row.
  await supabase
    .from("documents")
    .update({ kind: proposal.kind, vendor_name: proposal.vendor_name })
    .eq("id", doc.id);

  // 4. Stage the proposal as a draft (never authoritative).
  const { data: ext, error: extErr } = await supabase
    .from("document_extractions")
    .insert({ wedding_id: weddingId, document_id: doc.id, model, data: proposal, status: "draft" })
    .select("id")
    .single();
  if (extErr) return { ok: false, error: extErr.message };

  return { ok: true, documentId: doc.id, extractionId: ext.id, proposal };
}

// The human-reviewed, human-editable payload the Apply button sends. Every item
// carries an `include` flag; only included rows hit the budget tables.
const ApplyPayload = z.object({
  // Plain string ids: server-provided and gated by RLS. Not .uuid() — Zod v4's
  // strict RFC check rejects the seed's non-RFC id (11111111-…-111…).
  extractionId: z.string().min(1),
  weddingId: z.string().min(1),
  documentId: z.string().min(1),
  proposal: ProposalSchema,
  include: z.object({
    venue_costs: z.array(z.boolean()),
    caterers: z.array(z.boolean()),
    budget_lines: z.array(z.boolean()),
    payments: z.array(z.boolean()),
  }),
});

// Apply is the ONLY path from extraction to budget. Idempotent: it first clears
// anything previously applied from THIS document, then inserts the selected,
// human-corrected rows with provenance (source_document_id + source_item_key).
export async function applyExtraction(payload: z.infer<typeof ApplyPayload>): Promise<Result> {
  const parsed = ApplyPayload.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid payload" };
  const { extractionId, weddingId, documentId, proposal, include } = parsed.data;
  const supabase = await createClient();

  const pick = <T,>(rows: T[], flags: boolean[]) => rows.filter((_, i) => flags[i]);
  const prov = (key: string) => ({ source_document_id: documentId, source_item_key: slug(key) });

  // Everything maps into the generic budget_items model. Caterer options come in
  // INACTIVE — the couple activates the one they choose on the budget page.
  const vendor = proposal.vendor_name ?? null;
  const items = [
    ...pick(proposal.venue_costs, include.venue_costs).map((r) => ({
      wedding_id: weddingId, category: "Venue", label: r.label, cost_type: "flat", amount: r.amount, taxable: true, vendor, ...prov(r.label),
    })),
    ...pick(proposal.caterers, include.caterers).map((r) => ({
      wedding_id: weddingId, category: "Catering", label: r.package || r.name, cost_type: "per_guest",
      amount: r.price_pp, taxable: true, group_key: "caterer", active: false, vendor: r.name || vendor, ...prov(r.package || r.name),
    })),
    ...pick(proposal.budget_lines, include.budget_lines).map((r) => ({
      wedding_id: weddingId, category: "Other", label: r.label, cost_type: "flat", amount: r.amount, taxable: false, vendor, ...prov(r.label),
    })),
  ];
  const payments = pick(proposal.payments, include.payments).map((r) => ({
    wedding_id: weddingId,
    label: r.label,
    amount: r.amount,
    due_date: r.due.kind === "absolute" ? r.due.date : null,
    due_rule: r.due.kind === "unknown" ? null : r.due,
    ...prov(r.label),
  }));

  // Clear prior apply from this document, then insert fresh (idempotent re-Apply).
  for (const t of ["budget_items", "payments"] as const) {
    const del = await supabase.from(t).delete().eq("source_document_id", documentId);
    if (del.error) return { ok: false, error: del.error.message };
  }
  const inserts = [
    items.length && supabase.from("budget_items").insert(items),
    payments.length && supabase.from("payments").insert(payments),
  ].filter(Boolean);
  for (const ins of inserts) {
    const { error } = await ins as { error: { message: string } | null };
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("document_extractions").update({ status: "applied" }).eq("id", extractionId);
  await supabase.from("documents").update({ extracted: true }).eq("id", documentId);
  return { ok: true };
}
