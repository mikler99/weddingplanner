import Link from "next/link";
import { requireMembership } from "@/lib/wedding";
import { loadGuests } from "@/lib/guests";
import { createClient } from "@/lib/supabase/server";
import { SendClient } from "./SendClient";

export default async function SendPage() {
  const { wedding_id } = await requireMembership();
  const [data, supabase] = await Promise.all([loadGuests(wedding_id), createClient()]);
  if (!data) return null;
  const { data: w } = await supabase.from("weddings").select("name").eq("id", wedding_id).single();

  // Only hosts get a link; plus-ones ride on their host's invitation.
  const hosts = data.guests
    .filter((g) => !g.parent_id)
    .map((g) => ({ id: g.id, name: g.name, email: g.email, token: g.invite_token }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Guests &amp; RSVP</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="mt-1 font-display text-2xl font-semibold">Send invitations</h1>
          <Link href="/guests" className="text-sm text-accent hover:underline">← Back to guest list</Link>
        </div>
        <p className="text-sm text-muted">Each guest gets a private link to their personalized invitation and RSVP.</p>
      </header>
      <SendClient coupleName={w?.name ?? "Our Wedding"} hosts={hosts} />
    </main>
  );
}
