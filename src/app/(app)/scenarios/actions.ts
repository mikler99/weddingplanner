"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });

// Create a scenario, optionally cloning another's selections + guest count.
export async function createScenario(weddingId: string, name: string, cloneFrom?: string): Promise<Result & { id?: string }> {
  const clean = (name || "New scenario").trim().slice(0, 80);
  const supabase = await createClient();

  let guests = (await supabase.from("weddings").select("guest_estimate").eq("id", weddingId).single()).data?.guest_estimate ?? 80;
  if (cloneFrom) {
    const src = await supabase.from("scenarios").select("guests").eq("id", cloneFrom).single();
    if (src.data) guests = src.data.guests;
  }
  const { data, error } = await supabase.from("scenarios").insert({ wedding_id: weddingId, name: clean, guests, sort: 100 }).select("id").single();
  if (error) return fail(error.message);

  if (cloneFrom) {
    const links = (await supabase.from("scenario_items").select("item_id").eq("scenario_id", cloneFrom)).data ?? [];
    if (links.length) await supabase.from("scenario_items").insert(links.map((l) => ({ scenario_id: data.id, item_id: l.item_id })));
    // Copy the plan's payments + to-dos so the clone is a complete plan.
    const pays = (await supabase.from("payments").select("label, amount, due_date, due_rule, paid, vendor_id, source_document_id, source_item_key, sort").eq("scenario_id", cloneFrom)).data ?? [];
    if (pays.length) await supabase.from("payments").insert(pays.map((p) => ({ ...p, wedding_id: weddingId, scenario_id: data.id })));
    const tasks = (await supabase.from("milestones").select("when_label, due_date, due_rule, task, owner, done, vendor_id, sort").eq("scenario_id", cloneFrom)).data ?? [];
    if (tasks.length) await supabase.from("milestones").insert(tasks.map((t) => ({ ...t, wedding_id: weddingId, scenario_id: data.id })));
  }
  revalidatePath("/scenarios");
  return { ok: true, id: data.id };
}

// Promote a scenario to "the plan": exactly one active, and its guest count
// becomes the wedding's (which the whole app uses for the active plan).
export async function activateScenario(weddingId: string, scenarioId: string): Promise<Result> {
  const supabase = await createClient();
  const scen = await supabase.from("scenarios").select("guests").eq("id", scenarioId).single();
  if (scen.error) return fail(scen.error.message);
  await supabase.from("scenarios").update({ is_active: false }).eq("wedding_id", weddingId);
  const act = await supabase.from("scenarios").update({ is_active: true }).eq("id", scenarioId);
  if (act.error) return fail(act.error.message);
  await supabase.from("weddings").update({ guest_estimate: scen.data.guests }).eq("id", weddingId);
  revalidatePath("/", "layout"); // the plan drives the whole app
  return ok;
}

export async function renameScenario(id: string, name: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("scenarios").update({ name: name.trim().slice(0, 80) || "Scenario" }).eq("id", id);
  revalidatePath("/scenarios");
  return error ? fail(error.message) : ok;
}

export async function setScenarioGuests(id: string, guests: number, isActive: boolean, weddingId: string): Promise<Result> {
  const g = z.number().int().min(0).max(10000).safeParse(guests);
  if (!g.success) return fail("Invalid guest count");
  const supabase = await createClient();
  await supabase.from("scenarios").update({ guests: g.data }).eq("id", id);
  if (isActive) await supabase.from("weddings").update({ guest_estimate: g.data }).eq("id", weddingId);
  revalidatePath("/scenarios");
  if (isActive) revalidatePath("/", "layout");
  return ok;
}

export async function deleteScenario(id: string): Promise<Result> {
  const supabase = await createClient();
  const scen = await supabase.from("scenarios").select("is_active").eq("id", id).single();
  if (scen.data?.is_active) return fail("Make another scenario the plan before deleting this one.");
  const { error } = await supabase.from("scenarios").delete().eq("id", id);
  revalidatePath("/scenarios");
  return error ? fail(error.message) : ok;
}

// Add/remove an option from a scenario. Selecting an option in a mutually-
// exclusive group (e.g. a caterer) deselects the others in that scenario.
export async function toggleScenarioItem(scenarioId: string, itemId: string, on: boolean): Promise<Result> {
  const supabase = await createClient();
  if (!on) {
    const { error } = await supabase.from("scenario_items").delete().eq("scenario_id", scenarioId).eq("item_id", itemId);
    revalidatePath("/", "layout");
    return error ? fail(error.message) : ok;
  }
  const item = (await supabase.from("budget_items").select("group_key, wedding_id").eq("id", itemId).single()).data;
  if (item?.group_key) {
    const sibs = (await supabase.from("budget_items").select("id").eq("wedding_id", item.wedding_id).eq("group_key", item.group_key)).data ?? [];
    const sibIds = sibs.map((s) => s.id).filter((sid) => sid !== itemId);
    if (sibIds.length) await supabase.from("scenario_items").delete().eq("scenario_id", scenarioId).in("item_id", sibIds);
  }
  const { error } = await supabase.from("scenario_items").upsert({ scenario_id: scenarioId, item_id: itemId });
  revalidatePath("/", "layout");
  return error ? fail(error.message) : ok;
}
