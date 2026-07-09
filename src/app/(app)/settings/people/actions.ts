"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };
const fail = (e: string): Result => ({ ok: false, error: e });

// Only owners manage people. Returns the caller's user id if they own this wedding.
async function callerOwner(weddingId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("wedding_members").select("role").eq("wedding_id", weddingId).eq("user_id", user.id).maybeSingle();
  return data?.role === "owner" ? user.id : null;
}

async function ownerCount(admin: ReturnType<typeof createAdminClient>, weddingId: string): Promise<number> {
  const { count } = await admin.from("wedding_members").select("user_id", { count: "exact", head: true }).eq("wedding_id", weddingId).eq("role", "owner");
  return count ?? 0;
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function inviteMember(weddingId: string, email: string, role: "editor" | "viewer"): Promise<Result & { link?: string; emailed?: boolean }> {
  const inviter = await callerOwner(weddingId);
  if (!inviter) return fail("Only owners can invite people.");
  const e = z.string().email().safeParse(email.trim());
  if (!e.success) return fail("Enter a valid email address.");
  if (!["editor", "viewer"].includes(role)) return fail("Invalid role.");

  const admin = createAdminClient();
  const token = randomBytes(24).toString("base64url");
  const { error } = await admin.from("member_invites").insert({ wedding_id: weddingId, email: e.data, role, token, invited_by: inviter });
  if (error) return fail(error.message);

  const link = `${await origin()}/join/${token}`;
  const emailed = await sendInviteEmail(e.data, link, weddingId, role);
  revalidatePath("/settings/people");
  return { ok: true, link, emailed };
}

export async function changeRole(weddingId: string, userId: string, role: "owner" | "editor" | "viewer"): Promise<Result> {
  const caller = await callerOwner(weddingId);
  if (!caller) return fail("Only owners can change roles.");
  if (!["owner", "editor", "viewer"].includes(role)) return fail("Invalid role.");
  const admin = createAdminClient();
  // Don't allow demoting the last remaining owner.
  if (role !== "owner") {
    const { data: cur } = await admin.from("wedding_members").select("role").eq("wedding_id", weddingId).eq("user_id", userId).maybeSingle();
    if (cur?.role === "owner" && (await ownerCount(admin, weddingId)) <= 1) return fail("There must be at least one owner.");
  }
  const { error } = await admin.from("wedding_members").update({ role }).eq("wedding_id", weddingId).eq("user_id", userId);
  if (error) return fail(error.message);
  revalidatePath("/settings/people");
  return { ok: true };
}

export async function removeMember(weddingId: string, userId: string): Promise<Result> {
  const caller = await callerOwner(weddingId);
  if (!caller) return fail("Only owners can remove people.");
  const admin = createAdminClient();
  const { data: cur } = await admin.from("wedding_members").select("role").eq("wedding_id", weddingId).eq("user_id", userId).maybeSingle();
  if (cur?.role === "owner" && (await ownerCount(admin, weddingId)) <= 1) return fail("You can't remove the last owner.");
  const { error } = await admin.from("wedding_members").delete().eq("wedding_id", weddingId).eq("user_id", userId);
  if (error) return fail(error.message);
  revalidatePath("/settings/people");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<Result> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("member_invites").select("wedding_id").eq("id", inviteId).maybeSingle();
  if (!inv) return { ok: true };
  if (!(await callerOwner(inv.wedding_id))) return fail("Only owners can revoke invites.");
  const { error } = await admin.from("member_invites").delete().eq("id", inviteId);
  if (error) return fail(error.message);
  revalidatePath("/settings/people");
  return { ok: true };
}

async function sendInviteEmail(to: string, link: string, weddingId: string, role: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!key || !from) return false;
  const admin = createAdminClient();
  const name = (await admin.from("weddings").select("name").eq("id", weddingId).maybeSingle()).data?.name ?? "our wedding";
  const html = `<div style="font-family:Georgia,serif;padding:32px 24px;color:#222">
    <p style="font-size:18px;margin:0 0 8px">You've been invited to help plan <strong>${name}</strong></p>
    <p style="color:#555;margin:0 0 20px">You'll have <strong>${role === "editor" ? "editor" : "view-only"}</strong> access to the wedding planning hub.</p>
    <a href="${link}" style="display:inline-block;background:#5B5BD6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px">Accept invitation</a>
    <p style="color:#888;font-size:13px;margin-top:20px">${link}</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: `You're invited to plan ${name}`, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
