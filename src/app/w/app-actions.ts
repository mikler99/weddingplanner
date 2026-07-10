"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Wedding-day app: guests are anonymous, so every write is slug-scoped and goes
// through the service-role admin client (the tables/bucket have no anon policy).
// We resolve slug → wedding_id first and never trust a wedding id from the client.

const BUCKET = "wedding-photos";

async function weddingIdForSlug(slug: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("weddings").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

// --- Disposable camera -------------------------------------------------------

export type PhotoItem = { id: string; url: string; uploaderName: string | null; caption: string | null; prompt: string | null; createdAt: string };

// Hand the browser a one-shot signed upload URL for a path we control, so the
// anonymous guest can upload straight to storage without an insert policy.
export async function createPhotoUpload(slug: string, ext: string): Promise<{ ok: boolean; path?: string; token?: string; error?: string }> {
  const wid = await weddingIdForSlug(slug);
  if (!wid) return { ok: false, error: "Wedding not found." };
  const safeExt = /^(jpe?g|png|webp|heic|gif)$/i.test(ext) ? ext.toLowerCase() : "jpg";
  const path = `${wid}/${crypto.randomUUID()}.${safeExt}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Could not start the upload." };
  return { ok: true, path: data.path, token: data.token };
}

export async function addPhoto(input: { slug: string; path: string; uploaderName?: string; caption?: string; prompt?: string }): Promise<{ ok: boolean; error?: string }> {
  const wid = await weddingIdForSlug(input.slug);
  if (!wid) return { ok: false, error: "Wedding not found." };
  // The path must live under this wedding's folder — reject anything else.
  if (!input.path.startsWith(`${wid}/`)) return { ok: false, error: "Invalid upload." };
  const admin = createAdminClient();
  const { error } = await admin.from("wedding_photos").insert({
    wedding_id: wid,
    storage_path: input.path,
    uploader_name: clip(input.uploaderName, 60) || null,
    caption: clip(input.caption, 200) || null,
    prompt: clip(input.prompt, 200) || null,
  });
  if (error) return { ok: false, error: "Could not save the photo." };
  return { ok: true };
}

export async function getPhotos(slug: string, limit = 200): Promise<PhotoItem[]> {
  const wid = await weddingIdForSlug(slug);
  if (!wid) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("wedding_photos")
    .select("id, storage_path, uploader_name, caption, prompt, created_at")
    .eq("wedding_id", wid)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    url: admin.storage.from(BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
    uploaderName: r.uploader_name,
    caption: r.caption,
    prompt: r.prompt,
    createdAt: r.created_at,
  }));
}

// --- Guestbook ---------------------------------------------------------------

export type GuestbookItem = { id: string; name: string; message: string; createdAt: string };

export async function addGuestbook(input: { slug: string; name: string; message: string }): Promise<{ ok: boolean; error?: string }> {
  const wid = await weddingIdForSlug(input.slug);
  if (!wid) return { ok: false, error: "Wedding not found." };
  const name = clip(input.name, 60);
  const message = clip(input.message, 600);
  if (!name || message.length < 2) return { ok: false, error: "Please add your name and a message." };
  const admin = createAdminClient();
  const { error } = await admin.from("guestbook_entries").insert({ wedding_id: wid, name, message });
  if (error) return { ok: false, error: "Could not post your note." };
  return { ok: true };
}

export async function getGuestbook(slug: string, limit = 200): Promise<GuestbookItem[]> {
  const wid = await weddingIdForSlug(slug);
  if (!wid) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("guestbook_entries")
    .select("id, name, message, created_at")
    .eq("wedding_id", wid)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, message: r.message, createdAt: r.created_at }));
}

// --- Song requests -----------------------------------------------------------

export type SongItem = { id: string; title: string; artist: string | null; requestedBy: string | null; createdAt: string };

export async function addSong(input: { slug: string; title: string; artist?: string; requestedBy?: string }): Promise<{ ok: boolean; error?: string }> {
  const wid = await weddingIdForSlug(input.slug);
  if (!wid) return { ok: false, error: "Wedding not found." };
  const title = clip(input.title, 120);
  if (title.length < 1) return { ok: false, error: "Please add a song title." };
  const admin = createAdminClient();
  const { error } = await admin.from("song_requests").insert({
    wedding_id: wid,
    title,
    artist: clip(input.artist, 120) || null,
    requested_by: clip(input.requestedBy, 60) || null,
  });
  if (error) return { ok: false, error: "Could not add your request." };
  return { ok: true };
}

export async function getSongs(slug: string, limit = 200): Promise<SongItem[]> {
  const wid = await weddingIdForSlug(slug);
  if (!wid) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("song_requests")
    .select("id, title, artist, requested_by, created_at")
    .eq("wedding_id", wid)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, artist: r.artist, requestedBy: r.requested_by, createdAt: r.created_at }));
}
