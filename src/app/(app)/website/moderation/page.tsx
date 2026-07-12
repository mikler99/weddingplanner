import Link from "next/link";
import { requireModule } from "@/lib/wedding";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  await requireModule("website");
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-1 text-sm"><Link href="/website" className="text-accent hover:underline">← Website</Link></div>
      <h1 className="font-display text-2xl font-semibold">Moderation</h1>
      <p className="mt-2 text-sm text-muted">Review and hide guest photos, guestbook notes, and song requests. Coming next.</p>
    </div>
  );
}
