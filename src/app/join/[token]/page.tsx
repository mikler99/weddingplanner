import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptInvite } from "./actions";

const ROLE_DESC: Record<string, string> = { editor: "edit everything", viewer: "view everything (read-only)" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const admin = createAdminClient();
  const { data: inv } = await admin.from("member_invites").select("wedding_id, role, accepted_at").eq("token", token).maybeSingle();
  const valid = inv && !inv.accepted_at;
  const name = inv ? (await admin.from("weddings").select("name").eq("id", inv.wedding_id).maybeSingle()).data?.name ?? "this wedding" : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        {valid ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">You're invited</p>
            <h1 className="mt-2 font-display text-2xl font-semibold">{name}</h1>
            <p className="mt-2 text-sm text-muted">You'll be able to <strong>{ROLE_DESC[inv!.role] ?? inv!.role}</strong> on the planning hub.</p>
            <form action={acceptInvite.bind(null, token)} className="mt-5">
              <button className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Accept invitation</button>
            </form>
            <p className="mt-3 text-xs text-faint">Signed in as {user.email}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold">This invitation is no longer valid</h1>
            <p className="mt-2 text-sm text-muted">It may have already been used or revoked. Ask whoever invited you for a fresh link.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">Go to the hub →</Link>
          </>
        )}
      </div>
    </main>
  );
}
