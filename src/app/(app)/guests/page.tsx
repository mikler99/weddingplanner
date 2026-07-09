import Link from "next/link";
import { requireMembership } from "@/lib/wedding";
import { loadGuests } from "@/lib/guests";
import { GuestsClient } from "./GuestsClient";

export default async function GuestsPage() {
  const { wedding_id } = await requireMembership();
  const data = await loadGuests(wedding_id);
  if (!data) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Guests & RSVP</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="mt-1 font-display text-2xl font-semibold">Guest list</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/invite" className="text-accent hover:underline">Edit invitation →</Link>
            <Link href="/guests/send" className="text-accent hover:underline">Send invitations →</Link>
          </div>
        </div>
        <p className="text-sm text-muted">Track who’s invited and who’s coming. Import a spreadsheet or add people one by one.</p>
      </header>
      <GuestsClient weddingId={wedding_id} {...data} />
    </main>
  );
}
