"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ingestDocument } from "./actions";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,text/plain";

export function UploadForm({ weddingId }: { weddingId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${weddingId}/${crypto.randomUUID()}-${safe}`;

      setBusy("Uploading…");
      const up = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);

      setBusy("Extracting with Claude…");
      const res = await ingestDocument(weddingId, {
        storagePath: path,
        label: file.name,
        mime: file.type || "application/octet-stream",
      });
      if (!res.ok) throw new Error(res.error);

      router.push(`/documents/${res.documentId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={!!busy}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-60"
      >
        {busy ?? "Upload a quote or contract"}
      </button>
      <p className="mt-2 text-xs text-faint">PDF, image, or text · extraction takes a few seconds</p>
      {err && <p className="mt-3 text-sm text-bad">{err}</p>}
    </div>
  );
}
