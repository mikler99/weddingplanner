"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// The origin the request actually came in on (production domain behind Vercel),
// so confirmation links point back to the same site the user is using.
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

function readCreds(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

// Only allow safe same-site relative redirects (guards against open redirects).
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { email, password } = readCreds(formData);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?e=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData));
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const { email, password } = readCreds(formData);
  const next = safeNext(formData);
  const origin = await requestOrigin();

  // emailRedirectTo pins the confirmation link to THIS domain and carries the
  // invite target, so confirming lands the user on /join/<token> (or home).
  // It must be allow-listed under Supabase → Auth → URL Configuration.
  const emailRedirectTo = origin ? `${origin}/auth/confirm?next=${encodeURIComponent(next)}` : undefined;

  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
  if (error) {
    redirect(`/login?e=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is enabled, there's no session yet — tell the user.
  if (!data.session) {
    redirect("/login?m=check-email");
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
