import Link from "next/link";
import { requireMembership } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MembersClient } from "./MembersClient";

export default async function PeoplePage() {
  const { wedding_id, role } = await requireMembership();
  const isOwner = role === "owner";
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const [mRes, iRes] = await Promise.all([
    supabase.from("wedding_members").select("user_id, role").eq("wedding_id", wedding_id),
    supabase.from("member_invites").select("id, email, role, token, created_at").eq("wedding_id", wedding_id).is("accepted_at", null).order("created_at", { ascending: false }),
  ]);

  // Resolve member emails via the admin API (wedding_members only stores user_id).
  const members = await Promise.all((mRes.data ?? []).map(async (m) => {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    return { userId: m.user_id, role: m.role as "owner" | "editor" | "viewer", email: data.user?.email ?? "(unknown)", isSelf: m.user_id === user?.id };
  }));
  members.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Settings</p>
        <div className="flex items-baseline justify-between">
          <h1 className="mt-1 font-display text-2xl font-semibold">People</h1>
          <Link href="/settings" className="text-sm text-accent hover:underline">← Wedding details</Link>
        </div>
        <p className="text-sm text-muted">Invite family & friends. Editors can change things; viewers can see everything but can’t edit.</p>
      </header>
      <MembersClient
        weddingId={wedding_id}
        isOwner={isOwner}
        members={members}
        invites={(iRes.data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as "editor" | "viewer", token: isOwner ? i.token : "", created_at: i.created_at }))}
      />
    </main>
  );
}
