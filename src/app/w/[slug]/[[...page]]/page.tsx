import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INVITE_CSS } from "@/app/i/[token]/invite-styles";
import { SiteRenderer } from "@/app/i/[token]/InviteRenderer";
import { type InviteGuest } from "@/app/i/[token]/RsvpForm";
import { normalizeSite } from "@/lib/site-config";
import { fontsHref, type InviteConfig } from "@/lib/invite-config";

export const dynamic = "force-dynamic"; // public, per-wedding

type SiteRow = { wedding_id: string; name: string; event_date: string | null; venue_name: string | null; invite_config: InviteConfig | null };
type GuestRow = { name: string; max_seats: number; rsvp: "pending" | "yes" | "no"; attending_count: number | null; additional_names: unknown; dietary: string | null; slug: string | null };

export default async function SitePage({ params }: { params: Promise<{ slug: string; page?: string[] }> }) {
  const { slug, page } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_site_by_slug", { p_slug: slug });
  const row = (Array.isArray(data) ? data[0] : data) as SiteRow | undefined;
  if (!row) notFound();

  const site = normalizeSite(row.invite_config);
  const pageSlug = page?.[0] ?? "home";
  if (page?.[0] && !site.pages.some((p) => p.slug === page[0])) notFound();

  // Guest context: if they arrived via their personal link, a cookie identifies
  // them so the RSVP form is personalized. Verify the token belongs to THIS site.
  let token: string | undefined;
  let guest: InviteGuest | undefined;
  const gt = (await cookies()).get("guest_token")?.value;
  if (gt) {
    const gi = await supabase.rpc("get_invite", { p_token: gt });
    const g = (Array.isArray(gi.data) ? gi.data[0] : gi.data) as GuestRow | undefined;
    if (g && g.slug === slug) {
      token = gt;
      guest = { name: g.name, maxSeats: g.max_seats, rsvp: g.rsvp, attending: g.attending_count, additional: Array.isArray(g.additional_names) ? g.additional_names.map(String) : [], dietary: g.dietary };
    }
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontsHref(site.theme)} />
      <style dangerouslySetInnerHTML={{ __html: INVITE_CSS }} />
      <noscript><style dangerouslySetInnerHTML={{ __html: ".invite .rise{opacity:1;transform:none}" }} /></noscript>
      <SiteRenderer site={site} pageSlug={pageSlug} mode="live" base={`/w/${slug}`} token={token} guest={guest} />
    </>
  );
}
