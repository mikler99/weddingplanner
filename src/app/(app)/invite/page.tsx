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

/* Editor chrome — only present while building (EditorContext supplies it) */
.preview-pane.editing .ed-node{position:relative;outline:1px dashed transparent;transition:outline-color .12s;cursor:pointer}
.preview-pane.editing .ed-widget{min-height:8px}
.preview-pane.editing .ed-node:hover{outline-color:rgba(91,91,214,.55)}
.preview-pane.editing .ed-node.sel{outline:2px solid #7b7bea;outline-offset:-1px}
.preview-pane.editing .ed-node.faded{opacity:.4}
.preview-pane.editing .ed-tag{position:absolute;top:0;left:0;z-index:20;transform:translateY(-100%);background:#5B5BD6;color:#fff;font:600 10px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em;padding:1px 6px;border-radius:3px 3px 0 0;opacity:0;pointer-events:none;white-space:nowrap}
.preview-pane.editing .ed-node:hover>.ed-tag,.preview-pane.editing .ed-node.sel>.ed-tag{opacity:1}
.preview-pane.editing .ed-section.sel>.ed-tag,.preview-pane.editing .ed-section:hover>.ed-tag{background:#3f8f5b}
.preview-pane.editing .ed-tools{position:absolute;top:0;right:0;z-index:21;display:flex;gap:1px;transform:translateY(-100%)}
.preview-pane.editing .ed-tools button{background:#5B5BD6;color:#fff;border:0;width:22px;height:20px;font-size:11px;cursor:pointer;line-height:1}
.preview-pane.editing .ed-tools button:hover{background:#4747b8}
.preview-pane.editing .ed-drop{height:6px;margin:0;border-radius:3px;transition:background .1s,height .1s}
.preview-pane.editing .ed-drop.armed{height:14px;background:rgba(91,91,214,.12);outline:1px dashed rgba(91,91,214,.4)}
.preview-pane.editing .ed-drop.over{height:22px;background:rgba(91,91,214,.4)}
.preview-pane.editing .ed-empty-col{min-height:60px;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(91,91,214,.5);border-radius:4px;color:#9a92c9;font:500 12px ui-sans-serif,system-ui,sans-serif}
`;

export default async function InviteBuilderPage() {
  const { wedding_id } = await requireModule("website");
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
