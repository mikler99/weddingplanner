"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });

const vendorPatch = z
  .object({
    name: z.string().max(160).nullable(),
    category: z.string().max(60).nullable(),
    status: z.string().max(40),
    contact: z.string().max(200).nullable(),
    email: z.string().max(200).nullable(),
    phone: z.string().max(60).nullable(),
    website: z.string().max(300).nullable(),
    notes: z.string().max(2000).nullable(),
    next_step: z.string().max(300).nullable(),
  })
  .partial();

export async function updateVendor(id: string, patch: z.infer<typeof vendorPatch>): Promise<Result> {
  const p = vendorPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid vendor");
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").update(p.data).eq("id", id);
  return error ? fail(error.message) : ok;
}

export async function addVendor(weddingId: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("vendors").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("vendors")
    .insert({ wedding_id: weddingId, name: "New vendor", status: "Considering", sort: (max?.sort ?? -1) + 1 })
    .select("id")
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function deleteVendor(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  return error ? fail(error.message) : ok;
}

// Ensure a vendor entity exists for a supplier name (used when the budget/docs set
// a supplier). Returns its id. Relies on the (wedding_id, lower(name)) unique index.
export async function ensureVendor(weddingId: string, name: string, category?: string | null): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const existing = await supabase.from("vendors").select("id").eq("wedding_id", weddingId).ilike("name", clean).maybeSingle();
  if (existing.data) return existing.data.id;
  const { data } = await supabase.from("vendors").insert({ wedding_id: weddingId, name: clean, category: category ?? null, status: "Considering" }).select("id").single();
  return data?.id ?? null;
}
