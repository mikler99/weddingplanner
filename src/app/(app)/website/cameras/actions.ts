"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/wedding";
import { createClient } from "@/lib/supabase/server";

export type CameraTable = { id: string; name: string; shotLimit: number; token: string; sort: number; used: number };

const clampLimit = (n: number) => Math.max(1, Math.min(500, Math.round(Number.isFinite(n) ? n : 30)));
const cleanName = (s: string) => s.trim().slice(0, 60) || "Table";

// Editor-gated (RLS also enforces editor-write). Guests never call these.
export async function listTables(): Promise<CameraTable[]> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const [{ data: tables }, { data: photos }] = await Promise.all([
    supabase.from("camera_tables").select("id, name, shot_limit, token, sort, created_at").eq("wedding_id", wedding_id).order("sort").order("created_at"),
    supabase.from("wedding_photos").select("table_id").eq("wedding_id", wedding_id).not("table_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  (photos ?? []).forEach((p) => { const id = (p as { table_id: string | null }).table_id; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); });
  return (tables ?? []).map((t) => ({ id: t.id, name: t.name, shotLimit: t.shot_limit, token: t.token, sort: t.sort, used: counts.get(t.id) ?? 0 }));
}

export async function createTable(name: string, shotLimit: number): Promise<{ ok: boolean; error?: string }> {
  const { wedding_id } = await requireModule("website");
  const supabase = await createClient();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const { count } = await supabase.from("camera_tables").select("id", { count: "exact", head: true }).eq("wedding_id", wedding_id);
  const { error } = await supabase.from("camera_tables").insert({ wedding_id, name: cleanName(name), shot_limit: clampLimit(shotLimit), token, sort: count ?? 0 });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website/cameras");
  return { ok: true };
}

export async function updateTable(id: string, patch: { name?: string; shotLimit?: number }): Promise<{ ok: boolean; error?: string }> {
  await requireModule("website");
  const supabase = await createClient();
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = cleanName(patch.name);
  if (patch.shotLimit !== undefined) upd.shot_limit = clampLimit(patch.shotLimit);
  const { error } = await supabase.from("camera_tables").update(upd).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website/cameras");
  return { ok: true };
}

export async function deleteTable(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireModule("website");
  const supabase = await createClient();
  const { error } = await supabase.from("camera_tables").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/website/cameras");
  return { ok: true };
}
