import { createClient } from "@/lib/supabase/server";
import { summarize, type Guest, type GuestsView } from "@/lib/guests-core";

export type { Rsvp, Guest, GuestSummary, GuestsView } from "@/lib/guests-core";
export { summarize } from "@/lib/guests-core";

const COLS = "id, name, invite_token, email, parent_id, address, side, max_seats, invited, rsvp, attending_count, dietary, responded_at, sort";

// Side options from the wedding name, e.g. "Michael & Olivia McCann" → Michael / Olivia / Both.
function sidesFromName(name: string): string[] {
  const first = name
    .split(/&|\band\b|\+/)
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean);
  return first.length >= 2 ? [...new Set(first)].slice(0, 2).concat("Both") : ["Both"];
}

export async function loadGuests(weddingId: string): Promise<GuestsView | null> {
  const supabase = await createClient();
  const [gRes, wRes] = await Promise.all([
    supabase.from("guests").select(COLS).eq("wedding_id", weddingId).order("sort").order("name"),
    supabase.from("weddings").select("name, guest_estimate, rsvp_deadline").eq("id", weddingId).single(),
  ]);
  if (wRes.error || !wRes.data) return null;
  const guests = (gRes.data ?? []) as Guest[];
  return {
    guests,
    summary: summarize(guests),
    guestEstimate: wRes.data.guest_estimate ?? 0,
    sides: sidesFromName(wRes.data.name ?? ""),
    rsvpDeadline: wRes.data.rsvp_deadline ?? null,
    coupleName: wRes.data.name ?? "Our Wedding",
  };
}
