"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Find-by-name RSVP: a guest who didn't use their personal link identifies
// themselves on the public site. On a match we set the guest cookie (httpOnly,
// so the token never reaches the client) and the RSVP form personalizes on
// refresh. Anonymous, slug-scoped; matching is a soft check (names aren't secret).
export async function findInvite(slug: string, name: string): Promise<{ ok: boolean; found: boolean; error?: string }> {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, found: false, error: "Please enter your name." };

  const admin = createAdminClient();
  const wed = (await admin.from("weddings").select("id").eq("slug", slug).maybeSingle()).data;
  if (!wed) return { ok: false, found: false, error: "We couldn't find this wedding." };

  // Host guests only (plus-ones RSVP through their host); case-insensitive.
  const { data: rows } = await admin
    .from("guests")
    .select("invite_token")
    .eq("wedding_id", wed.id)
    .is("parent_id", null)
    .ilike("name", clean)
    .limit(1);
  const token = rows?.[0]?.invite_token;
  if (!token) return { ok: true, found: false };

  (await cookies()).set("guest_token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  return { ok: true, found: true };
}
