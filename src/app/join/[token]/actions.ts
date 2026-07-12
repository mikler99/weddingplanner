"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
type Invite = { id: string; wedding_id: string; email: string; role: "owner" | "editor" | "viewer"; allowed_modules: string[] | null; accepted_at: string | null };

async function loadInvite(admin: Admin, token: string): Promise<Invite | null> {
  const { data } = await admin.from("member_invites").select("id, wedding_id, email, role, allowed_modules, accepted_at").eq("token", token).maybeSingle();
  return (data as Invite) ?? null;
}

// Link the user to the wedding with the invited role + module access, then close
// the invite. wedding_members has no self-insert path, so this uses the admin client.
async function linkMembership(admin: Admin, inv: Invite, userId: string) {
  const { data: existing } = await admin.from("wedding_members").select("user_id").eq("wedding_id", inv.wedding_id).eq("user_id", userId).maybeSingle();
  if (existing) {
    await admin.from("wedding_members").update({ role: inv.role, allowed_modules: inv.allowed_modules }).eq("wedding_id", inv.wedding_id).eq("user_id", userId);
  } else {
    await admin.from("wedding_members").insert({ wedding_id: inv.wedding_id, user_id: userId, role: inv.role, allowed_modules: inv.allowed_modules });
  }
  await admin.from("member_invites").update({ accepted_at: new Date().toISOString(), accepted_by: userId }).eq("id", inv.id);
}

// Sign out and return to the invite (to join as the invited person instead of
// the currently signed-in account).
export async function switchAccount(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/join/${token}`);
}

// Already-signed-in path: just link + accept.
export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/join/${token}`);

  const admin = createAdminClient();
  const inv = await loadInvite(admin, token);
  if (!inv || inv.accepted_at) redirect(`/join/${token}`);
  await linkMembership(admin, inv!, user!.id);

  revalidatePath("/", "layout");
  redirect("/");
}

// Find an existing auth user by email (small project → a single page is plenty).
async function findUserByEmail(admin: Admin, email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
}

// The intelligent path for a brand-new invitee: no email confirmation at all.
// The invite link IS the proof of email, so we provision the account directly
// (auto-confirmed) and sign them in. Careful with an email that already has a
// REAL account: never reset its password — require the existing one.
export async function claimInvite(token: string, password: string): Promise<{ ok: false; error: string }> {
  if (typeof password !== "string" || password.length < 8) return { ok: false, error: "Choose a password of at least 8 characters." };

  const admin = createAdminClient();
  const inv = await loadInvite(admin, token);
  if (!inv || inv.accepted_at) return { ok: false, error: "This invitation is no longer valid — ask for a fresh link." };

  const email = inv.email;
  let existingConfirmed = false;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    // Likely already exists. Adopt a leftover UNCONFIRMED signup (safe — it was
    // never completed); for a confirmed account, verify the password instead.
    const existing = await findUserByEmail(admin, email);
    if (!existing) return { ok: false, error: created.error?.message ?? "Could not create your account." };
    const confirmed = !!(existing.email_confirmed_at ?? existing.confirmed_at);
    if (!confirmed) {
      const upd = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (upd.error) return { ok: false, error: upd.error.message };
    } else {
      existingConfirmed = true;
    }
  }

  // Establish the session (also verifies the password for an existing account).
  const supabase = await createClient();
  const { data: signed, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr || !signed.user) {
    return { ok: false, error: existingConfirmed ? "This email already has an account — enter its existing password to join." : (signErr?.message ?? "Could not sign you in.") };
  }

  await linkMembership(admin, inv, signed.user.id);
  revalidatePath("/", "layout");
  redirect("/");
}
