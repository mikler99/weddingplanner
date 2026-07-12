import Link from "next/link";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { normalizeSite } from "@/lib/site-config";
import { normalizePage, findWidget } from "@/lib/site-nodes";
import { listTables } from "./actions";
import { CamerasClient } from "./CamerasClient";

export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const { data } = await supabase.from("weddings").select("slug, invite_config").eq("id", wedding_id).single();
  const slug = (data?.slug as string | null) ?? null;

  // Where does the camera live? Point each table's QR at the first page that
  // has a camera block (so the scan lands on a working camera).
  let camPath = "";
  const site = normalizeSite(data?.invite_config);
  for (const p of site.pages) {
    if (findWidget(normalizePage(p), "camera")) { camPath = p.slug === "home" ? "" : `/${p.slug}`; break; }
  }
  const hasCamera = camPath !== "" || site.pages.some((p) => findWidget(normalizePage(p), "camera"));

  const tables = await listTables();

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-1 text-sm"><Link href="/website" className="text-accent hover:underline">← Website</Link></div>
      <h1 className="font-display text-2xl font-semibold">Cameras &amp; tables</h1>
      <p className="mt-1 text-sm text-muted">Give each table its own QR code and a shared roll of film. Guests scan the card on their table to shoot into your gallery, capped at the table&rsquo;s limit.</p>

      {!slug && <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">Set a web address in <Link href="/website/settings" className="text-accent hover:underline">Site settings</Link> before printing QR codes.</p>}
      {slug && !hasCamera && <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">Your site doesn&rsquo;t have a <strong>Disposable camera</strong> block yet. Add one in the <Link href="/invite" className="text-accent hover:underline">designer</Link> so the QR codes have a camera to open.</p>}

      <div className="mt-5">
        <CamerasClient initial={tables} slug={slug} camPath={camPath} />
      </div>
    </div>
  );
}
