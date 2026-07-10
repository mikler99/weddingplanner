import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/wedding";
import { UploadForm } from "./UploadForm";
import { DeleteDocButton } from "./DeleteDocButton";

export default async function DocumentsPage() {
  const { wedding_id } = await requireModule("documents");
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, label, kind, vendor_name, extracted, storage_path")
    .eq("wedding_id", wedding_id)
    .order("sort");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted">
            Upload a quote or contract — Claude extracts the costs for you to review, then apply.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted hover:underline">← Home</Link>
      </header>

      <UploadForm weddingId={wedding_id} />

      <ul className="mt-8 divide-y divide-line">
        {(docs ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{d.label}</p>
              <p className="text-xs text-muted">
                {d.vendor_name ? `${d.vendor_name} · ` : ""}{d.kind}
                {d.extracted && <span className="ml-1 rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-good">options added</span>}
                {!d.storage_path && <span className="ml-1 text-faint">· no file</span>}
              </p>
            </div>
            <div className="flex flex-none items-center gap-4">
              {d.storage_path && (
                <Link href={`/documents/${d.id}`} className="text-sm text-accent hover:underline">
                  Review →
                </Link>
              )}
              <DeleteDocButton id={d.id} label={d.label} />
            </div>
          </li>
        ))}
        {(docs ?? []).length === 0 && (
          <li className="py-3 text-sm text-faint">No documents yet.</li>
        )}
      </ul>
    </main>
  );
}
