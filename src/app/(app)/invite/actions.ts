"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SiteConfig } from "@/lib/site-config";

// Persist the builder's site config to weddings.invite_config (RLS editor-write).
// It's the couple's own page data, so a light shape guard is enough.
export async function saveInviteConfig(weddingId: string, config: SiteConfig): Promise<{ ok: boolean; error?: string }> {
  if (!config || !config.theme || !Array.isArray(config.pages) || config.pages.length === 0) return { ok: false, error: "Invalid config" };
  if (config.pages.length > 20) return { ok: false, error: "Too many pages" };
  if (config.pages.some((p) => (p.sections?.length ?? 0) > 40)) return { ok: false, error: "Too many sections on a page" };
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ invite_config: config }).eq("id", weddingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invite");
  revalidatePath("/w", "layout");
  return { ok: true };
}
