// Pure guest types + tallying — safe to import from client components
// (no server-only Supabase import here).

export type Rsvp = "pending" | "yes" | "no";

export type Guest = {
  id: string;
  name: string;
  invite_token: string; // per-guest public RSVP token → /i/<token>
  email: string | null;
  parent_id: string | null; // set on a plus-one the host brought (nested, not tallied)
  address: string | null;
  side: string | null;
  max_seats: number;
  invited: boolean;
  rsvp: Rsvp;
  attending_count: number | null;
  dietary: string | null;
  sort: number;
};

export type GuestSummary = {
  parties: number; // guest rows (households / invitations)
  invitedParties: number;
  seats: number; // sum(max_seats) — total invited capacity
  attending: number; // confirmed heads (yes)
  declined: number; // seats that said no
  pending: number; // invited seats still awaiting a reply
};

export type GuestsView = {
  guests: Guest[];
  summary: GuestSummary;
  guestEstimate: number; // the active plan's headcount (what the budget uses)
  sides: string[]; // Side options derived from the couple's names
};

export function summarize(guests: Guest[]): GuestSummary {
  // Plus-one children (parent_id set) are already counted in their host's
  // max_seats / attending_count, so exclude them to avoid double counting.
  return guests.filter((g) => !g.parent_id).reduce<GuestSummary>(
    (a, g) => {
      a.parties += 1;
      if (g.invited) a.invitedParties += 1;
      a.seats += g.max_seats;
      if (g.rsvp === "yes") a.attending += g.attending_count ?? g.max_seats;
      else if (g.rsvp === "no") a.declined += g.max_seats;
      else if (g.invited) a.pending += g.max_seats;
      return a;
    },
    { parties: 0, invitedParties: 0, seats: 0, attending: 0, declined: 0, pending: 0 }
  );
}
