"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Form-action variant used on the overview (sets the overall target).
export async function setTarget(weddingId: string, formData: FormData) {
  const raw = String(formData.get("target") ?? "").replace(/[^0-9.]/g, "");
  const n = raw === "" ? null : Number(raw);
  const supabase = await createClient();
  await supabase.from("weddings").update({ budget_target: n }).eq("id", weddingId);
  revalidatePath("/budget");
  revalidatePath("/");
}

// Create a new category (returns nothing; used from the workbench tab bar).
export async function addCategory(weddingId: string, name: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: "Name required" };
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_categories")
    .insert({ wedding_id: weddingId, name: clean, slug, color: "#7A8290", sort: 50 });
  if (error) return { ok: false, error: error.message };
  return { ok: true, slug };
}

// Move an item to another category (by name).
export async function moveItem(id: string, category: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").update({ category }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// All writes run under the user's RLS session (editor-write policy), so no extra
// auth checks. Money totals are NEVER written — only the inputs the budget
// derives from: the items, the guest count, the tax rate, and the savings plan.

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });
const money = z.number().finite().min(0);

export async function setGuestEstimate(weddingId: string, guests: number): Promise<Result> {
  const g = z.number().int().min(0).max(10000).safeParse(guests);
  if (!g.success) return fail("Invalid guest count");
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({ guest_estimate: g.data }).eq("id", weddingId);
  // Keep the active scenario's headcount in sync (it's the live plan).
  await supabase.from("scenarios").update({ guests: g.data }).eq("wedding_id", weddingId).eq("is_active", true);
  return error ? fail(error.message) : ok;
}

const configPatch = z.object({ tax_rate: z.number().min(0).max(1), saved: money, monthly: money }).partial();
export async function updateConfig(weddingId: string, patch: z.infer<typeof configPatch>): Promise<Result> {
  const p = configPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid config");
  const supabase = await createClient();
  const { error } = await supabase.from("budget_config").update(p.data).eq("wedding_id", weddingId);
  return error ? fail(error.message) : ok;
}

const itemPatch = z
  .object({
    category: z.string().max(60),
    label: z.string().max(200),
    vendor: z.string().max(120).nullable(),
    cost_type: z.enum(["flat", "per_guest"]),
    amount: money,
    taxable: z.boolean(),
    service_pct: z.number().min(0).max(100),
    active: z.boolean(),
  })
  .partial();

export async function updateItem(id: string, patch: z.infer<typeof itemPatch>): Promise<Result> {
  const p = itemPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid item");
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").update(p.data).eq("id", id);
  return error ? fail(error.message) : ok;
}

// Activate exactly one item in a mutually-exclusive group (e.g. the chosen caterer).
export async function activateInGroup(weddingId: string, groupKey: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const clear = await supabase.from("budget_items").update({ active: false }).eq("wedding_id", weddingId).eq("group_key", groupKey);
  if (clear.error) return fail(clear.error.message);
  const { error } = await supabase.from("budget_items").update({ active: true }).eq("id", id);
  return error ? fail(error.message) : ok;
}

export async function addItem(weddingId: string, category: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("budget_items").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("budget_items")
    .insert({ wedding_id: weddingId, category: category || "Other", label: "New item", cost_type: "flat", amount: 0, sort: (max?.sort ?? -1) + 1 })
    .select("id")
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function deleteItem(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").delete().eq("id", id);
  return error ? fail(error.message) : ok;
}

// Set the supplier for a category by stamping it on its (selected) items.
export async function setCategoryVendor(itemIds: string[], vendor: string | null): Promise<Result> {
  if (itemIds.length === 0) return ok;
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").update({ vendor: vendor || null }).in("id", itemIds.slice(0, 200));
  return error ? fail(error.message) : ok;
}

// All-inclusive package: either a single line (split unknown → its own
// "All-inclusive" category) or split across the categories it covers, entered
// as dollars or percentages. Items are created and selected into the scenario.
const packagePayload = z.object({
  scenarioId: z.string().min(1),
  name: z.string().min(1).max(120), // the package name → bundle pill
  vendor: z.string().max(120).optional(), // supplier (e.g. the venue)
  costType: z.enum(["flat", "per_guest"]),
  amountMode: z.enum(["amount", "percent", "even"]),
  total: money.optional(), // for percent / even
  rows: z.array(z.object({ category: z.string().min(1).max(60), label: z.string().min(1).max(120), value: money.optional() })).min(1).max(12),
});

async function ensureCategory(supabase: Awaited<ReturnType<typeof createClient>>, weddingId: string, name: string) {
  const exists = await supabase.from("budget_categories").select("id").eq("wedding_id", weddingId).eq("name", name).maybeSingle();
  if (exists.data) return;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
  const color = name === "All-inclusive" ? "#B0894F" : "#7A8290";
  await supabase.from("budget_categories").insert({ wedding_id: weddingId, name, slug, color, sort: 60 });
}

export async function createPackage(weddingId: string, payload: z.infer<typeof packagePayload>): Promise<Result> {
  const p = packagePayload.safeParse(payload);
  if (!p.success) return fail("Invalid package");
  const d = p.data;
  const supabase = await createClient();

  const n = d.rows.length;
  const rows = d.rows.map((r) => {
    const amount =
      d.amountMode === "percent" ? ((d.total ?? 0) * (r.value ?? 0)) / 100 :
      d.amountMode === "even" ? (d.total ?? 0) / n :
      (r.value ?? 0);
    return { category: r.category, label: r.label, amount: Math.round(amount * 100) / 100 };
  });

  for (const cat of new Set(rows.map((r) => r.category))) await ensureCategory(supabase, weddingId, cat);

  const { data: max } = await supabase.from("budget_items").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const base = (max?.sort ?? -1) + 1;
  const items = rows.map((r, i) => ({
    wedding_id: weddingId, category: r.category, label: r.label, cost_type: d.costType, amount: r.amount, taxable: true, bundle: d.name, vendor: d.vendor || null, sort: base + i,
  }));
  const { data: created, error } = await supabase.from("budget_items").insert(items).select("id");
  if (error) return fail(error.message);

  const { error: selErr } = await supabase.from("scenario_items").insert(created.map((c) => ({ scenario_id: d.scenarioId, item_id: c.id })));
  if (selErr) return fail(selErr.message);
  revalidatePath("/", "layout");
  return ok;
}

const giftPatch = z.object({ label: z.string().max(200), amount: money }).partial();
export async function updateGift(id: string, patch: z.infer<typeof giftPatch>): Promise<Result> {
  const p = giftPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid gift");
  const supabase = await createClient();
  const { error } = await supabase.from("gifts").update(p.data).eq("id", id);
  return error ? fail(error.message) : ok;
}

export async function addGift(weddingId: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("gifts").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("gifts")
    .insert({ wedding_id: weddingId, label: "Gift", amount: 0, sort: (max?.sort ?? -1) + 1 })
    .select("id")
    .single();
  return error ? { ok: false, error: error.message } : { ok: true, id: data.id };
}

export async function deleteGift(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("gifts").delete().eq("id", id);
  return error ? fail(error.message) : ok;
}
