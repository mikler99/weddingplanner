"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InviteConfig } from "@/lib/invite-config";

// Persist the builder's config to weddings.invite_config (RLS editor-write).
// It's the couple's own page data, so a light shape guard is enough.
export async function saveInviteConfig(weddingId: string, config: InviteConfig): Promise<{ ok: boolean; error?: string }> {
  if (!config || !config.theme || !Array.isArray(config.sections)) return { ok: false, error: "Invalid config" };
  if (config.sections.length > 40) return { ok: false, error: "Too many sections" };
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ invite_config: config }).eq("id", weddingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invite");
  return { ok: true };
}
