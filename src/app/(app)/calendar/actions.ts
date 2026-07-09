"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STARTER_TODOS, STARTER_PAYMENTS } from "@/lib/planner-templates";

// Manual CRUD for the payment plan + to-do list (the calendar's two sidebars).
// Dates are set by hand here; a stored due_rule (e.g. Quayle's "12 months prior")
// still resolves for display, but a manual due_date always wins.

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const vendorId = z.string().min(1).nullable(); // not .uuid(): our seed ids aren't RFC-4122
const dueRule = z
  .object({
    kind: z.enum(["on_booking", "before_event", "absolute", "unknown"]),
    value: z.number().nullable(),
    unit: z.enum(["days", "weeks", "months", "years"]).nullable(),
    date: z.string().nullable(),
  })
  .nullable();

function bump() { revalidatePath("/calendar"); revalidatePath("/"); }

/* ------------------------------- Payments ------------------------------- */

const paymentPatch = z
  .object({
    label: z.string().max(200),
    amount: z.number().finite().min(0),
    due_date: isoDate.nullable(),
    due_rule: dueRule,
    paid: z.boolean(),
    vendor_id: vendorId,
  })
  .partial();

export async function updatePayment(id: string, patch: z.infer<typeof paymentPatch>): Promise<Result> {
  const p = paymentPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid payment");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update(p.data).eq("id", id);
  if (error) return fail(error.message);
  bump();
  return ok;
}

export async function addPayment(weddingId: string, scenarioId: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("payments").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("payments")
    .insert({ wedding_id: weddingId, scenario_id: scenarioId, label: "New payment", amount: 0, sort: (max?.sort ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  bump();
  return { ok: true, id: data.id };
}

export async function deletePayment(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return fail(error.message);
  bump();
  return ok;
}

/* -------------------------------- Tasks --------------------------------- */

const taskPatch = z
  .object({
    task: z.string().max(300),
    due_date: isoDate.nullable(),
    due_rule: dueRule,
    done: z.boolean(),
    owner: z.string().max(120).nullable(),
    vendor_id: vendorId,
  })
  .partial();

export async function updateTask(id: string, patch: z.infer<typeof taskPatch>): Promise<Result> {
  const p = taskPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid task");
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").update(p.data).eq("id", id);
  if (error) return fail(error.message);
  bump();
  return ok;
}

export async function addTask(weddingId: string, scenarioId: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("milestones").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("milestones")
    .insert({ wedding_id: weddingId, scenario_id: scenarioId, task: "New to-do", when_label: "", sort: (max?.sort ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  bump();
  return { ok: true, id: data.id };
}

// Add a single suggested to-do (a standard checklist item not yet present).
export async function addSuggestedTask(weddingId: string, scenarioId: string, task: string, rule: z.infer<typeof dueRule>): Promise<Result> {
  const supabase = await createClient();
  const r = dueRule.safeParse(rule);
  const { data: max } = await supabase.from("milestones").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("milestones").insert({ wedding_id: weddingId, scenario_id: scenarioId, task: task.slice(0, 300), when_label: "", due_rule: r.success ? r.data : null, sort: (max?.sort ?? -1) + 1 });
  if (error) return fail(error.message);
  bump();
  return ok;
}

const suggestedPayment = z.object({
  label: z.string().max(200),
  amount: z.number().finite().min(0),
  due_date: isoDate.nullable(),
  due_rule: dueRule,
  vendor_id: vendorId,
  source_document_id: z.string().min(1),
  source_item_key: z.string().max(80),
});

// Add a payment back from a contract (carries provenance so it re-links).
export async function addSuggestedPayment(weddingId: string, scenarioId: string, input: z.infer<typeof suggestedPayment>): Promise<Result> {
  const p = suggestedPayment.safeParse(input);
  if (!p.success) return fail("Invalid payment");
  const supabase = await createClient();
  const { data: max } = await supabase.from("payments").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("payments").insert({ wedding_id: weddingId, scenario_id: scenarioId, sort: (max?.sort ?? -1) + 1, ...p.data });
  if (error) return fail(error.message);
  bump();
  return ok;
}

// One-click starter plan: a standard, wedding-date-relative to-do checklist +
// placeholder payments, into the given scenario.
export async function applyStarterChecklist(weddingId: string, scenarioId: string): Promise<Result & { added?: number }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("milestones").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  let base = (max?.sort ?? -1) + 1;
  const tasks = STARTER_TODOS.map((t) => ({ wedding_id: weddingId, scenario_id: scenarioId, task: t.task, when_label: "", due_rule: t.rule, sort: base++ }));
  const t = await supabase.from("milestones").insert(tasks);
  if (t.error) return fail(t.error.message);
  const { data: pmax } = await supabase.from("payments").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  let pbase = (pmax?.sort ?? -1) + 1;
  const pays = STARTER_PAYMENTS.map((p) => ({ wedding_id: weddingId, scenario_id: scenarioId, label: p.label, amount: 0, due_rule: p.rule, sort: pbase++ }));
  const pr = await supabase.from("payments").insert(pays);
  if (pr.error) return fail(pr.error.message);
  bump();
  return { ok: true, added: tasks.length + pays.length };
}

export async function deleteTask(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) return fail(error.message);
  bump();
  return ok;
}
