"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SiteSettings = { slug: string | null; published: boolean; seoTitle: string; seoDescription: string; seoImage: string; name: string };

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export async function loadSiteSettings(): Promise<SiteSettings> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const { data } = await supabase.from("weddings").select("slug, site_published, seo_title, seo_description, seo_image, name").eq("id", wedding_id).single();
  return {
    slug: data?.slug ?? null,
    published: data?.site_published ?? true,
    seoTitle: data?.seo_title ?? "",
    seoDescription: data?.seo_description ?? "",
    seoImage: data?.seo_image ?? "",
    name: data?.name ?? "",
  };
}

export async function setSlug(raw: string): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const { wedding_id } = await requireModule("website");
  const slug = slugify(raw);
  if (slug.length < 3) return { ok: false, error: "Use at least 3 characters — letters, numbers and hyphens." };
  // Uniqueness must look across ALL weddings, so use the service-role client
  // (RLS would otherwise hide other couples' rows and let clashes through).
  const admin = createAdminClient();
  const { data: clash } = await admin.from("weddings").select("id").eq("slug", slug).neq("id", wedding_id).maybeSingle();
  if (clash) return { ok: false, error: "That address is already taken — try another." };
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ slug }).eq("id", wedding_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website"); revalidatePath("/w", "layout");
  return { ok: true, slug };
}

export async function setPublished(published: boolean): Promise<{ ok: boolean; error?: string }> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ site_published: published }).eq("id", wedding_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website"); revalidatePath("/w", "layout");
  return { ok: true };
}

export async function updateSeo(patch: { title?: string; description?: string; image?: string }): Promise<{ ok: boolean; error?: string }> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const upd: Record<string, unknown> = {};
  if (patch.title !== undefined) upd.seo_title = patch.title.trim().slice(0, 120) || null;
  if (patch.description !== undefined) upd.seo_description = patch.description.trim().slice(0, 300) || null;
  if (patch.image !== undefined) upd.seo_image = patch.image.trim() || null;
  const { error } = await supabase.from("weddings").update(upd).eq("id", wedding_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website"); revalidatePath("/w", "layout");
  return { ok: true };
}
