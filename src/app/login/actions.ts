"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    redirect(`/login?e=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is enabled, there's no session yet — tell the user.
  if (!data.session) {
    redirect("/login?m=check-email");
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
