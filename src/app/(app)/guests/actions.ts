"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Guest rows are wedding-scoped and RLS-gated (editor-write). No money here —
// the guest count only reaches the budget when the user adopts it (useHeadcount).

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });

const guestPatch = z
  .object({
    name: z.string().max(200),
    email: z.string().max(200).nullable(),
    address: z.string().max(300).nullable(),
    side: z.string().max(60).nullable(),
    max_seats: z.number().int().min(1).max(20),
    invited: z.boolean(),
    rsvp: z.enum(["pending", "yes", "no"]),
    attending_count: z.number().int().min(0).max(20).nullable(),
    dietary: z.string().max(300).nullable(),
  })
  .partial();

export async function updateGuest(id: string, patch: z.infer<typeof guestPatch>): Promise<Result> {
  const p = guestPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid guest");
  const supabase = await createClient();
  const { error } = await supabase.from("guests").update(p.data).eq("id", id);
  return error ? fail(error.message) : ok;
}

export async function addGuest(weddingId: string): Promise<Result & { id?: string; token?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("guests").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("guests")
    .insert({ wedding_id: weddingId, name: "New guest", max_seats: 1, sort: (max?.sort ?? -1) + 1 })
    .select("id, invite_token")
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id, token: data.invite_token };
}

export async function deleteGuest(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("guests").delete().eq("id", id);
  return error ? fail(error.message) : ok;
}

const importRow = z.object({
  name: z.string().min(1).max(200),
  email: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  side: z.string().max(60).optional(),
  max_seats: z.number().int().min(1).max(20).optional(),
  dietary: z.string().max(300).optional(),
});

// Bulk add from a parsed CSV (client maps flexible headers → these fields).
export async function importGuests(weddingId: string, rows: z.infer<typeof importRow>[]): Promise<Result & { added?: number }> {
  const parsed = z.array(importRow).min(1).max(1000).safeParse(rows);
  if (!parsed.success) return fail("Some rows were invalid — check the file and try again.");
  const supabase = await createClient();
  const { data: max } = await supabase.from("guests").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  let base = (max?.sort ?? -1) + 1;
  const toInsert = parsed.data.map((r) => ({
    wedding_id: weddingId,
    name: r.name,
    email: r.email ?? null,
    address: r.address ?? null,
    side: r.side ?? null,
    max_seats: r.max_seats ?? 1,
    dietary: r.dietary ?? null,
    invited: true,
    sort: base++,
  }));
  const { error } = await supabase.from("guests").insert(toInsert);
  if (error) return fail(error.message);
  revalidatePath("/guests");
  return { ok: true, added: toInsert.length };
}

// The RSVP-by date the couple asks guests to reply by (drives the nudge + reminders).
export async function setRsvpDeadline(weddingId: string, date: string | null): Promise<Result> {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ rsvp_deadline: d }).eq("id", weddingId);
  if (error) return fail(error.message);
  revalidatePath("/guests");
  return ok;
}

// Adopt the confirmed headcount as the budget's guest number (fired from the nudge).
export async function useHeadcount(weddingId: string, guests: number): Promise<Result> {
  const g = z.number().int().min(0).max(10000).safeParse(guests);
  if (!g.success) return fail("Invalid count");
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ guest_estimate: g.data }).eq("id", weddingId);
  await supabase.from("scenarios").update({ guests: g.data }).eq("wedding_id", weddingId).eq("is_active", true);
  revalidatePath("/", "layout");
  return error ? fail(error.message) : ok;
}
