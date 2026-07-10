import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/wedding";
import { ProposalSchema } from "@/lib/extract";
import { money } from "@/lib/format";
import { ReviewClient } from "./ReviewClient";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { wedding_id } = await requireModule("documents");
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, label, vendor_name, extracted")
    .eq("id", id)
    .single();
  if (!doc) notFound();

  const { data: wed } = await supabase.from("weddings").select("event_date").eq("id", wedding_id).single();

  const { data: ext } = await supabase
    .from("document_extractions")
    .select("id, data, status, model")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ext) notFound();

  const parsed = ProposalSchema.safeParse(ext.data);
  if (!parsed.success) notFound();

  // What this document has actually contributed to the budget (provenance loop).
  const [items, payments] = await Promise.all([
    supabase.from("budget_items").select("label, category, amount, cost_type, active").eq("source_document_id", id),
    supabase.from("payments").select("label, amount").eq("source_document_id", id),
  ]);
  const contributed = [
    ...(items.data ?? []).map((i) => ({ label: i.label, meta: `${i.category}${i.active ? "" : " · inactive"}`, amount: i.amount, unit: i.cost_type })),
    ...(payments.data ?? []).map((p) => ({ label: p.label, meta: "Payment", amount: p.amount, unit: "flat" as const })),
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review extraction</h1>
          <p className="text-sm text-muted">
            {doc.label} · extracted by {ext.model}. Correct anything before applying — nothing is in the budget yet.
          </p>
        </div>
        <Link href="/documents" className="text-sm text-muted hover:underline">← Documents</Link>
      </header>

      <ReviewClient
        extractionId={ext.id}
        weddingId={wedding_id}
        documentId={doc.id}
        proposal={parsed.data}
        eventDate={wed?.event_date ?? new Date().toISOString().slice(0, 10)}
        alreadyApplied={ext.status === "applied"}
      />

      {contributed.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-muted">Options added from this document</h2>
          <ul className="flex flex-col divide-y divide-line">
            {contributed.map((c, i) => (
              <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex-1 truncate">{c.label} <span className="text-xs text-faint">· {c.meta}</span></span>
                <span className="tabular-nums">{money(c.amount)}{c.unit === "per_guest" ? "/pp" : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">Select these into a plan on the <Link href="/budget" className="text-accent hover:underline">budget</Link>.</p>
        </section>
      )}
    </main>
  );
}
