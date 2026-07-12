import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptInvite, switchAccount } from "./actions";
import { JoinClient } from "./JoinClient";
import { MODULES } from "@/lib/modules";

const ROLE_DESC: Record<string, string> = { owner: "manage everything", editor: "edit everything", viewer: "view everything (read-only)" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: inv } = await admin.from("member_invites").select("wedding_id, email, role, allowed_modules, accepted_at").eq("token", token).maybeSingle();
  const valid = inv && !inv.accepted_at;
  const name = inv ? (await admin.from("weddings").select("name").eq("id", inv.wedding_id).maybeSingle()).data?.name ?? "this wedding" : null;
  const moduleLabels = valid && inv!.allowed_modules
    ? MODULES.filter((m) => m.key === "hub" || inv!.allowed_modules!.includes(m.key)).map((m) => m.label)
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-line bg-surface p-8">
        {!valid ? (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold">This invitation is no longer valid</h1>
            <p className="mt-2 text-sm text-muted">It may have already been used or revoked. Ask whoever invited you for a fresh link.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">Go to the hub →</Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">You&rsquo;re invited</p>
              <h1 className="mt-2 font-display text-2xl font-semibold">{name}</h1>
              <p className="mt-2 text-sm text-muted">You&rsquo;ll be able to <strong>{ROLE_DESC[inv!.role] ?? inv!.role}</strong>{moduleLabels ? <> on: {moduleLabels.join(", ")}</> : " on the planning hub"}.</p>
            </div>

            {user ? (
              (() => {
                const mismatch = (user.email ?? "").toLowerCase() !== inv!.email.toLowerCase();
                return (
                  <div className="mt-6">
                    {mismatch && (
                      <p className="mb-3 rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">This invite was sent to <strong>{inv!.email}</strong>, but you&rsquo;re signed in as <strong>{user.email}</strong>.</p>
                    )}
                    <form action={acceptInvite.bind(null, token)}>
                      <button className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Accept as {user.email}</button>
                    </form>
                    <form action={switchAccount.bind(null, token)} className="mt-2 text-center">
                      <button className="text-xs text-accent hover:underline">{mismatch ? `Sign out & join as ${inv!.email}` : "Use a different account"}</button>
                    </form>
                  </div>
                );
              })()
            ) : (
              <JoinClient token={token} email={inv!.email} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
