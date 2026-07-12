import Link from "next/link";
import { requireModule } from "@/lib/wedding";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  await requireModule("website");
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-1 text-sm"><Link href="/website" className="text-accent hover:underline">← Website</Link></div>
      <h1 className="font-display text-2xl font-semibold">Site settings</h1>
      <p className="mt-2 text-sm text-muted">Web address, publish on/off, and social-share preview. Coming next. For now the web address lives in <Link href="/settings" className="text-accent hover:underline">wedding settings</Link>.</p>
    </div>
  );
}
