import Link from "next/link";
import { requireModule } from "@/lib/wedding";
import { loadModeration } from "./actions";
import { ModerationClient } from "./ModerationClient";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  await requireModule("website");
  const data = await loadModeration();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-1 text-sm"><Link href="/website" className="text-accent hover:underline">← Website</Link></div>
      <h1 className="font-display text-2xl font-semibold">Moderation</h1>
      <p className="mt-1 text-sm text-muted">Everything guests have added. <strong>Hide</strong> removes it from the live site (reversible); <strong>✕</strong> deletes it for good.</p>
      <div className="mt-5"><ModerationClient initial={data} /></div>
    </div>
  );
}
