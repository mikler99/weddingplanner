"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SiteConfig } from "@/lib/site-config";

// Persist the builder's site config to weddings.invite_config (RLS editor-write).
// It's the couple's own page data, so a light shape guard is enough.
export async function saveInviteConfig(weddingId: string, config: SiteConfig): Promise<{ ok: boolean; error?: string }> {
  if (!config || !config.theme || !Array.isArray(config.pages) || config.pages.length === 0) return { ok: false, error: "Invalid config" };
  if (config.pages.length > 20) return { ok: false, error: "Too many pages" };
  // A page holds either legacy `sections` or the new `blocks` tree; cap both.
  const blockWidgets = (b: unknown): number => {
    const sec = b as { columns?: { children?: unknown[] }[] };
    return (sec.columns ?? []).reduce((n, c) => n + (c.children?.length ?? 0), 0);
  };
  for (const p of config.pages) {
    if ((p.sections?.length ?? 0) > 40) return { ok: false, error: "Too many sections on a page" };
    const blocks = (p.blocks ?? []) as unknown[];
    if (blocks.length > 60) return { ok: false, error: "Too many sections on a page" };
    if (blocks.reduce((n: number, b) => n + blockWidgets(b), 0) > 300) return { ok: false, error: "Too many elements on a page" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ invite_config: config }).eq("id", weddingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invite");
  revalidatePath("/w", "layout");
  return { ok: true };
}
