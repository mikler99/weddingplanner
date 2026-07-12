"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";

export type ModPhoto = { id: string; url: string; uploaderName: string | null; caption: string | null; prompt: string | null; hidden: boolean; createdAt: string };
export type ModNote = { id: string; name: string; message: string; hidden: boolean; createdAt: string };
export type ModSong = { id: string; title: string; artist: string | null; requestedBy: string | null; hidden: boolean; createdAt: string };
export type ModerationData = { photos: ModPhoto[]; notes: ModNote[]; songs: ModSong[] };

export type ModKind = "photo" | "note" | "song";
const TABLE: Record<ModKind, string> = { photo: "wedding_photos", note: "guestbook_entries", song: "song_requests" };

// Member-read RLS returns hidden rows too, so the couple sees everything.
export async function loadModeration(): Promise<ModerationData> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const [ph, gb, sg] = await Promise.all([
    supabase.from("wedding_photos").select("id, storage_path, uploader_name, caption, prompt, hidden, created_at").eq("wedding_id", wedding_id).order("created_at", { ascending: false }),
    supabase.from("guestbook_entries").select("id, name, message, hidden, created_at").eq("wedding_id", wedding_id).order("created_at", { ascending: false }),
    supabase.from("song_requests").select("id, title, artist, requested_by, hidden, created_at").eq("wedding_id", wedding_id).order("created_at", { ascending: false }),
  ]);
  const pub = (p: string) => supabase.storage.from("wedding-photos").getPublicUrl(p).data.publicUrl;
  return {
    photos: (ph.data ?? []).map((r) => ({ id: r.id, url: pub(r.storage_path), uploaderName: r.uploader_name, caption: r.caption, prompt: r.prompt, hidden: r.hidden, createdAt: r.created_at })),
    notes: (gb.data ?? []).map((r) => ({ id: r.id, name: r.name, message: r.message, hidden: r.hidden, createdAt: r.created_at })),
    songs: (sg.data ?? []).map((r) => ({ id: r.id, title: r.title, artist: r.artist, requestedBy: r.requested_by, hidden: r.hidden, createdAt: r.created_at })),
  };
}

// Hide/show removes an item from the live site without deleting it.
export async function setHidden(kind: ModKind, id: string, hidden: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireModule("website");
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[kind]).update({ hidden }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website/moderation"); revalidatePath("/w", "layout");
  return { ok: true };
}

export async function removeItem(kind: ModKind, id: string): Promise<{ ok: boolean; error?: string }> {
  await requireModule("website");
  const supabase = await createClient();
  if (kind === "photo") {
    const { data } = await supabase.from("wedding_photos").select("storage_path").eq("id", id).maybeSingle();
    if (data?.storage_path) await supabase.storage.from("wedding-photos").remove([data.storage_path]);
  }
  const { error } = await supabase.from(TABLE[kind]).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website/moderation"); revalidatePath("/w", "layout");
  return { ok: true };
}
