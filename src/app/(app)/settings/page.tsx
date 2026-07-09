import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/wedding";
import { updateWeddingInfo } from "./actions";

export default async function SettingsPage() {
  const { wedding_id, role } = await requireMembership();
  const supabase = await createClient();

  const [wedding, config, members] = await Promise.all([
    supabase.from("weddings").select("id, name, event_date, venue_name, venue_address, guest_estimate, guest_guarantee, region, budget_target").eq("id", wedding_id).single(),
    supabase.from("budget_config").select("tax_rate").eq("wedding_id", wedding_id).single(),
    supabase.from("wedding_members").select("role").eq("wedding_id", wedding_id),
  ]);
  const w = wedding.data;
  if (!w) notFound();
  const taxPct = Math.round((config.data?.tax_rate ?? 0.13) * 1000) / 10;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Wedding details</h1>
        <p className="text-sm text-muted">The high-level facts everything else is built on — the date drives your payment schedule and countdown, guest count drives per-guest costs, tax drives every taxable line.</p>
      </header>

      <form action={updateWeddingInfo.bind(null, w.id)} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6">
        <Field label="Wedding name" hint="Shown across the app (e.g. “Olivia & Michael”).">
          <input name="name" defaultValue={w.name} required className="input" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wedding date" hint="Re-derives due dates & countdown.">
            <input type="date" name="event_date" defaultValue={w.event_date} required className="input" />
          </Field>
          <Field label="Region" hint="For tax defaults.">
            <input name="region" defaultValue={w.region ?? "ON"} className="input" />
          </Field>
        </div>

        <Field label="Venue" hint="Name and address.">
          <input name="venue_name" defaultValue={w.venue_name ?? ""} placeholder="Venue name" className="input" />
          <input name="venue_address" defaultValue={w.venue_address ?? ""} placeholder="Address" className="input mt-2" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Guest estimate" hint="Drives per-guest costs.">
            <input type="number" name="guest_estimate" defaultValue={w.guest_estimate} min={0} className="input" />
          </Field>
          <Field label="Guaranteed count" hint="Minimum you'll pay for.">
            <input type="number" name="guest_guarantee" defaultValue={w.guest_guarantee} min={0} className="input" />
          </Field>
          <Field label="Tax rate %" hint="Applied to taxable items.">
            <input type="number" name="tax_rate" defaultValue={taxPct} step="0.1" min={0} className="input" />
          </Field>
        </div>

        <Field label="Budget target" hint="Optional overall goal.">
          <input name="budget_target" inputMode="decimal" defaultValue={w.budget_target ?? ""} placeholder="e.g. 35000" className="input" />
        </Field>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-xs text-muted">{members.data?.length ?? 1} member{(members.data?.length ?? 1) === 1 ? "" : "s"} · you're {role}</span>
          <button className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Save details</button>
        </div>
      </form>

      <Link href="/settings/people" className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition hover:border-accent">
        <span>
          <span className="block text-sm font-medium">People &amp; access →</span>
          <span className="block text-xs text-muted">Invite family &amp; friends, manage roles (editors &amp; viewers)</span>
        </span>
        <span className="text-lg">👥</span>
      </Link>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--line);background:var(--surface);padding:0.5rem 0.75rem;font-size:0.875rem;color:var(--ink)}`}</style>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}
