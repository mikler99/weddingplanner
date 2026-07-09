"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sumMonthly, EXPENSE_STARTER, type Frequency } from "@/lib/finance";

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });

// Recompute the cached monthly totals on budget_config from the itemized lines,
// so computeBudget + the hub savings status stay correct (they read `monthly`).
async function recacheFinances(supabase: Awaited<ReturnType<typeof createClient>>, weddingId: string) {
  const { data } = await supabase.from("finance_lines").select("kind, amount, frequency").eq("wedding_id", weddingId);
  const rows = (data ?? []).map((l) => ({ kind: l.kind as string, amount: Number(l.amount), frequency: l.frequency as Frequency }));
  const income = sumMonthly(rows.filter((l) => l.kind === "income"));
  const expenses = sumMonthly(rows.filter((l) => l.kind === "expense"));
  await supabase.from("budget_config").update({
    monthly_income: Math.round(income * 100) / 100,
    monthly_expenses: Math.round(expenses * 100) / 100,
    monthly: Math.max(0, Math.round((income - expenses) * 100) / 100),
  }).eq("wedding_id", weddingId);
}

const bump = () => { revalidatePath("/savings"); revalidatePath("/"); revalidatePath("/budget"); };

const linePatch = z
  .object({
    label: z.string().max(200),
    amount: z.number().finite().min(0),
    frequency: z.enum(["monthly", "weekly", "biweekly", "annual"]),
    person: z.string().max(60).nullable(),
    category: z.string().max(60).nullable(),
  })
  .partial();

export async function addLine(weddingId: string, kind: "income" | "expense"): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("finance_lines").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("finance_lines")
    .insert({ wedding_id: weddingId, kind, label: kind === "income" ? "Income" : "Expense", amount: 0, frequency: "monthly", category: kind === "expense" ? "Other" : null, sort: (max?.sort ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await recacheFinances(supabase, weddingId);
  bump();
  return { ok: true, id: data.id };
}

export async function updateLine(id: string, patch: z.infer<typeof linePatch>): Promise<Result> {
  const p = linePatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid line");
  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_lines").update(p.data).eq("id", id).select("wedding_id").single();
  if (error) return fail(error.message);
  if (data) await recacheFinances(supabase, data.wedding_id);
  bump();
  return ok;
}

export async function deleteLine(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_lines").delete().eq("id", id).select("wedding_id").single();
  if (error) return fail(error.message);
  if (data) await recacheFinances(supabase, data.wedding_id);
  bump();
  return ok;
}

export async function applyExpenseStarter(weddingId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: max } = await supabase.from("finance_lines").select("sort").eq("wedding_id", weddingId).order("sort", { ascending: false }).limit(1).maybeSingle();
  let base = (max?.sort ?? -1) + 1;
  const rows = EXPENSE_STARTER.map((e) => ({ wedding_id: weddingId, kind: "expense", label: e.label, amount: 0, frequency: "monthly", category: e.category, sort: base++ }));
  const { error } = await supabase.from("finance_lines").insert(rows);
  if (error) return fail(error.message);
  await recacheFinances(supabase, weddingId);
  bump();
  return ok;
}
