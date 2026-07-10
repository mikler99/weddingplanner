import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { INVITE_CSS } from "@/app/i/[token]/invite-styles";
import { fontsHref } from "@/lib/invite-config";
import { normalizeSite } from "@/lib/site-config";
import { BuilderClient } from "./BuilderClient";

// Contains the invite's fixed backgrounds inside the preview pane instead of the
// whole builder viewport, and lets the preview size to its container.
const PREVIEW_CSS = `
.preview-pane{position:relative;overflow:auto;background:#0e0a06}
.preview-pane .invite{min-height:100%;position:relative;isolation:isolate}
.preview-pane .invite .bg-wood,.preview-pane .invite .bg-veil{position:absolute}
.preview-pane.mobile .invite{width:400px;margin:0 auto}
`;

export default async function InviteBuilderPage() {
  const { wedding_id } = await requireModule("guests");
  const supabase = await createClient();
  const { data } = await supabase.from("weddings").select("invite_config").eq("id", wedding_id).single();
  const site = normalizeSite(data?.invite_config);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link id="invite-fonts" rel="stylesheet" href={fontsHref(site.theme)} />
      <style dangerouslySetInnerHTML={{ __html: INVITE_CSS + PREVIEW_CSS }} />
      <BuilderClient weddingId={wedding_id} initial={site} />
    </>
  );
}
