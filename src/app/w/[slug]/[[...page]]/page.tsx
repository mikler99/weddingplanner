import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INVITE_CSS } from "@/app/i/[token]/invite-styles";
import { SiteRenderer } from "@/app/i/[token]/InviteRenderer";
import { normalizeSite } from "@/lib/site-config";
import { fontsHref, type InviteConfig } from "@/lib/invite-config";

export const dynamic = "force-dynamic"; // public, per-wedding

type SiteRow = { wedding_id: string; name: string; event_date: string | null; venue_name: string | null; invite_config: InviteConfig | null };

export default async function SitePage({ params }: { params: Promise<{ slug: string; page?: string[] }> }) {
  const { slug, page } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_site_by_slug", { p_slug: slug });
  const row = (Array.isArray(data) ? data[0] : data) as SiteRow | undefined;
  if (!row) notFound();

  const site = normalizeSite(row.invite_config);
  const pageSlug = page?.[0] ?? "home";
  if (page?.[0] && !site.pages.some((p) => p.slug === page[0])) notFound();

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontsHref(site.theme)} />
      <style dangerouslySetInnerHTML={{ __html: INVITE_CSS }} />
      <noscript><style dangerouslySetInnerHTML={{ __html: ".invite .rise{opacity:1;transform:none}" }} /></noscript>
      <SiteRenderer site={site} pageSlug={pageSlug} mode="live" base={`/w/${slug}`} />
    </>
  );
}
