"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Public RSVP submit. The visitor is anonymous — the only write path to a guest
// row is the SECURITY DEFINER submit_rsvp RPC (granted to anon), which enforces
// the seat cap server-side. No RLS write policy exists for guests, by design.

const payload = z.object({
  token: z.string().min(1).max(64),
  rsvp: z.enum(["yes", "no"]),
  attending: z.number().int().min(0).max(20),
  additional: z.array(z.string().max(120)).max(20),
  dietary: z.string().max(500).nullable(),
});

export async function submitRsvp(input: z.infer<typeof payload>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = payload.safeParse(input);
  if (!p.success) return { ok: false, error: "Please check your response and try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_rsvp", {
    p_token: p.data.token,
    p_rsvp: p.data.rsvp,
    p_attending: p.data.rsvp === "yes" ? Math.max(1, p.data.attending) : 0,
    p_additional: p.data.rsvp === "yes" ? p.data.additional.filter((n) => n.trim()) : [],
    p_dietary: p.data.dietary?.trim() || null,
  });
  return error ? { ok: false, error: "Something went wrong sending your reply. Please try again." } : { ok: true };
}
