import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccess, type ModuleKey } from "@/lib/modules";

export type Membership = {
  wedding_id: string;
  role: "owner" | "editor" | "viewer";
  allowedModules: string[] | null; // null = all modules
};

// Resolves the signed-in user's wedding via wedding_members (RLS-enforced).
// Returns null if not signed in or not a member of any wedding.
export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("wedding_members")
    .select("wedding_id, role, allowed_modules")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { wedding_id: data.wedding_id, role: data.role, allowedModules: data.allowed_modules ?? null };
}

// Use in protected Server Components: guarantees a membership or redirects.
// (middleware already blocks anonymous users; this also catches signed-in
// users who haven't been linked to a wedding yet.)
export async function requireMembership(): Promise<Membership> {
  const m = await getMembership();
  if (!m) redirect("/onboarding");
  return m;
}

// Guards a module (page): membership + module access. Owners always have access.
// A member restricted to certain modules is redirected to the hub otherwise.
export async function requireModule(moduleKey: ModuleKey): Promise<Membership> {
  const m = await requireMembership();
  if (m.role !== "owner" && !canAccess(moduleKey, m.allowedModules)) redirect("/");
  return m;
}
