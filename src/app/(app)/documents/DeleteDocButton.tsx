"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument } from "./actions";

export function DeleteDocButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onClick = () => {
    if (!confirm(`Remove "${label}"? The file is deleted. Any budget items it created stay, but lose their link to it.`)) return;
    start(async () => {
      const res = await deleteDocument(id);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Delete failed");
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={err ?? "Remove document"}
      className={`text-sm ${err ? "text-bad" : "text-faint hover:text-bad"} disabled:opacity-50`}
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
