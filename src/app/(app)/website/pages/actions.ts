"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { normalizeSite, uniqueSlug, type SiteConfig, type SiteNav } from "@/lib/site-config";

export type PageMeta = { id: string; title: string; slug: string; showInNav: boolean };
export type PagesNav = { slug: string | null; pages: PageMeta[]; nav: SiteNav };

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

export async function loadPagesNav(): Promise<PagesNav> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const { data } = await supabase.from("weddings").select("slug, invite_config").eq("id", wedding_id).single();
  const site = normalizeSite(data?.invite_config);
  return {
    slug: (data?.slug as string | null) ?? null,
    nav: site.nav ?? {},
    pages: site.pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, showInNav: p.showInNav })),
  };
}

// Saves page order (first = home), per-page title/slug/nav-visibility, and the
// nav (brand + custom links) — merged into the stored config so each page keeps
// its sections/blocks. Pages omitted from `order` are deleted.
export async function savePagesNav(order: string[], meta: Record<string, { title: string; slug: string; showInNav: boolean }>, nav: SiteNav): Promise<{ ok: boolean; error?: string }> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const { data } = await supabase.from("weddings").select("invite_config").eq("id", wedding_id).single();
  const site = normalizeSite(data?.invite_config);
  const byId = new Map(site.pages.map((p) => [p.id, p]));

  const used: string[] = [];
  const pages = order.map((id, i) => {
    const p = byId.get(id);
    if (!p) return null;
    const m = meta[id];
    const base = slugify(m?.slug || p.slug || `page-${i + 1}`) || `page-${i + 1}`;
    const slug = uniqueSlug(base, used);
    used.push(slug);
    return { ...p, title: (m?.title ?? p.title).trim().slice(0, 60) || "Page", slug, showInNav: m?.showInNav ?? p.showInNav };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  if (pages.length === 0) return { ok: false, error: "Your site needs at least one page." };

  const cleanNav: SiteNav = {
    brand: nav.brand?.trim().slice(0, 40) || undefined,
    links: (nav.links ?? []).filter((l) => l.label?.trim()).slice(0, 12).map((l) => ({ id: l.id, label: l.label.trim().slice(0, 40), href: (l.href || "").trim().slice(0, 300) })),
  };

  const next: SiteConfig = { ...site, nav: cleanNav, pages };
  const { error } = await supabase.from("weddings").update({ invite_config: next }).eq("id", wedding_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website/pages"); revalidatePath("/invite"); revalidatePath("/w", "layout");
  return { ok: true };
}
