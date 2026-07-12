import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { INVITE_CSS } from "@/app/i/[token]/invite-styles";
import { SiteRenderer } from "@/app/i/[token]/InviteRenderer";
import { type InviteGuest } from "@/app/i/[token]/RsvpForm";
import { normalizeSite } from "@/lib/site-config";
import { fontsHref, type InviteConfig } from "@/lib/invite-config";

export const dynamic = "force-dynamic"; // public, per-wedding

type SiteRow = { wedding_id: string; name: string; event_date: string | null; venue_name: string | null; invite_config: InviteConfig | null; site_published: boolean; seo_title: string | null; seo_description: string | null; seo_image: string | null };
type GuestRow = { name: string; max_seats: number; rsvp: "pending" | "yes" | "no"; attending_count: number | null; additional_names: unknown; dietary: string | null; slug: string | null };

async function fetchSite(slug: string): Promise<SiteRow | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_site_by_slug", { p_slug: slug });
  return (Array.isArray(data) ? data[0] : data) as SiteRow | undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await fetchSite(slug);
  if (!row) return { title: "Wedding" };
  const title = row.seo_title || row.name || "Our Wedding";
  const description = row.seo_description || undefined;
  const images = row.seo_image ? [row.seo_image] : undefined;
  return { title, description, openGraph: { title, description, images, type: "website" }, twitter: { card: "summary_large_image", title, description, images } };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string; page?: string[] }> }) {
  const { slug, page } = await params;
  const supabase = await createClient();
  const row = await fetchSite(slug);
  if (!row) notFound();

  // Publish gate: an unpublished site shows a "coming soon" placeholder to the
  // public, but a signed-in member of this wedding can still preview it.
  let previewing = false;
  if (!row.site_published) {
    const { data: m } = await supabase.from("wedding_members").select("role").eq("wedding_id", row.wedding_id).maybeSingle();
    if (!m) return <ComingSoon name={row.name} />;
    previewing = true;
  }

  const site = normalizeSite(row.invite_config);
  const pageSlug = page?.[0]; // undefined → home (first page)
  if (pageSlug && !site.pages.some((p) => p.slug === pageSlug)) notFound();

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
      {previewing && (
        <div style={{ position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9998, background: "#5B5BD6", color: "#fff", padding: "8px 16px", borderRadius: 999, font: "600 12px ui-sans-serif,system-ui,sans-serif", boxShadow: "0 8px 24px -8px rgba(0,0,0,.5)" }}>
          Preview — this site isn’t published yet
        </div>
      )}
      <SiteRenderer site={site} pageSlug={pageSlug} mode="live" base={`/w/${slug}`} slug={slug} token={token} guest={guest} />
    </>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0a06", color: "#efe4cf", fontFamily: "'Cormorant Garamond',Georgia,serif", textAlign: "center", padding: 24 }}>
      <div>
        <div style={{ fontSize: ".7rem", letterSpacing: ".3em", textTransform: "uppercase", color: "#c9a86a", fontFamily: "system-ui,sans-serif" }}>Coming soon</div>
        <h1 style={{ fontSize: "2.6rem", margin: "14px 0 0", fontWeight: 500 }}>{name || "Our Wedding"}</h1>
        <p style={{ color: "#c4b79c", marginTop: 10, fontSize: "1.15rem", fontStyle: "italic" }}>Our wedding website is on its way — check back soon.</p>
      </div>
    </div>
  );
}
