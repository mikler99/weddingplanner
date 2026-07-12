import Link from "next/link";
import { requireModule } from "@/lib/wedding";
import { loadSiteSettings } from "./actions";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  await requireModule("website");
  const settings = await loadSiteSettings();
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-1 text-sm"><Link href="/website" className="text-accent hover:underline">← Website</Link></div>
      <h1 className="font-display text-2xl font-semibold">Site settings</h1>
      <p className="mt-1 text-sm text-muted">Your web address, whether the site is live, and its social-share preview.</p>
      <div className="mt-5"><SettingsClient initial={settings} /></div>
    </div>
  );
}
