import type { DueRule } from "@/lib/payments";

// Relative-to-the-wedding planning starters. Stored as due_rule so dates shift
// if the wedding date moves (and resolve via resolveDue).

const before = (value: number, unit: NonNullable<DueRule["unit"]>): DueRule => ({ kind: "before_event", value, unit, date: null });
const atBooking: DueRule = { kind: "on_booking", value: null, unit: null, date: null };

export const STARTER_TODOS: { task: string; rule: DueRule }[] = [
  { task: "Book ceremony & reception venue", rule: before(12, "months") },
  { task: "Book caterer", rule: before(11, "months") },
  { task: "Book photographer & videographer", rule: before(10, "months") },
  { task: "Send save-the-dates", rule: before(9, "months") },
  { task: "Book officiant and DJ / band", rule: before(8, "months") },
  { task: "Shop for attire (dress & suits)", rule: before(7, "months") },
  { task: "Book florist and rentals", rule: before(6, "months") },
  { task: "Plan the honeymoon", rule: before(5, "months") },
  { task: "Order invitations; schedule cake tasting", rule: before(4, "months") },
  { task: "Mail invitations; finalize the menu", rule: before(3, "months") },
  { task: "Hair & makeup trial; buy the rings", rule: before(2, "months") },
  { task: "Final fitting; confirm details with vendors", rule: before(1, "months") },
  { task: "Give final headcount to the caterer", rule: before(2, "weeks") },
  { task: "Confirm the timeline with all vendors; pack", rule: before(1, "weeks") },
];

export const STARTER_PAYMENTS: { label: string; rule: DueRule }[] = [
  { label: "Vendor deposits", rule: atBooking },
  { label: "Final balances", rule: before(2, "weeks") },
];
