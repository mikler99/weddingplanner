import Link from "next/link";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CARDS = [
  { href: "/invite", icon: "🎨", title: "Design your site", desc: "The drag-and-drop builder — pages, elements, theme.", ready: true },
  { href: "/website/cameras", icon: "📷", title: "Cameras & tables", desc: "Per-table QR codes and shared rolls of film.", ready: true },
  { href: "/website/moderation", icon: "🛡️", title: "Moderation", desc: "Review guest photos, guestbook notes & song requests.", ready: true },
  { href: "/website/settings", icon: "⚙️", title: "Site settings", desc: "Web address, publish on/off, and social-share preview.", ready: true },
  { href: "/website/pages", icon: "🗂️", title: "Pages & navigation", desc: "Per-page URLs, home page, and the nav menu.", ready: true },
];

export default async function WebsiteHub() {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const { data } = await supabase.from("weddings").select("slug, name").eq("id", wedding_id).single();
  const slug = data?.slug as string | null;
  const url = slug ? `/w/${slug}` : null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="font-display text-2xl font-semibold">Website</h1>
      <p className="mt-1 text-sm text-muted">Everything for your public wedding site and wedding-day app.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Your site address</p>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="block truncate text-accent hover:underline">{url}</a>
          ) : (
            <p className="text-sm text-muted">Set a web address in <Link href="/website/settings" className="text-accent hover:underline">Site settings</Link>.</p>
          )}
        </div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium hover:border-accent">View live ↗</a>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="group rounded-xl border border-line bg-surface p-4 transition hover:border-accent">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div className="min-w-0">
                <p className="font-medium group-hover:text-accent">{c.title}</p>
                <p className="mt-0.5 text-sm text-muted">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
