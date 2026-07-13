"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SiteConfig } from "@/lib/site-config";

// Persist the builder's site config to weddings.invite_config (RLS editor-write).
// It's the couple's own page data, so a light shape guard is enough.
export async function saveInviteConfig(weddingId: string, config: SiteConfig): Promise<{ ok: boolean; error?: string }> {
  if (!config || !config.theme || !Array.isArray(config.pages) || config.pages.length === 0) return { ok: false, error: "Invalid config" };
  if (config.pages.length > 50) return { ok: false, error: "This site has too many pages (max 50)." };
  // A page holds either legacy `sections` or the new `blocks` tree. These caps
  // are just runaway guards — set generously so real content never trips them.
  const blockWidgets = (b: unknown): number => {
    const sec = b as { columns?: { children?: unknown[] }[] };
    return (sec.columns ?? []).reduce((n, c) => n + (c.children?.length ?? 0), 0);
  };
  for (const p of config.pages) {
    const blocks = (p.blocks ?? []) as unknown[];
    if (blocks.length > 300) return { ok: false, error: "This page has too many sections (max 300)." };
    if (blocks.reduce((n: number, b) => n + blockWidgets(b), 0) > 2000) return { ok: false, error: "This page has too many elements (max 2000)." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ invite_config: config }).eq("id", weddingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invite");
  revalidatePath("/w", "layout");
  return { ok: true };
}
