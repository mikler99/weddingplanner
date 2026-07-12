import { redirect } from "next/navigation";
import { getMembership } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGIONS } from "@/lib/wedding-defaults";
import { createWedding } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  // Already have a wedding? Straight to the hub.
  if (await getMembership()) redirect("/");
  const { e } = await searchParams;

  // Invited but not yet joined? Send them to accept, not create a new wedding.
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user?.email) {
    const { data: pending } = await createAdminClient()
      .from("member_invites").select("token").ilike("email", user.email).is("accepted_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (pending?.token) redirect(`/join/${pending.token}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Welcome</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Let&apos;s set up your wedding</h1>
        <p className="mt-1 text-sm text-muted">Just the basics — you can change any of it later, and we&apos;ll start you off with categories and a checklist.</p>
      </div>

      {e && <p className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">Something went wrong creating your wedding. Please try again.</p>}

      <form action={createWedding} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Who&apos;s getting married?</span>
          <input name="name" required placeholder="e.g. Olivia & Michael" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Wedding date</span>
            <input type="date" name="event_date" required className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
            <span className="text-xs text-faint">A best guess is fine — change it anytime.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Rough guest count</span>
            <input type="number" name="guest_estimate" defaultValue={80} min={0} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Where?</span>
          <select name="region" defaultValue="ON" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <span className="text-xs text-faint">Sets your default tax rate (editable in settings).</span>
        </label>

        <button className="mt-1 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Create our wedding →
        </button>
      </form>
    </main>
  );
}
