"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (e: string): Result => ({ ok: false, error: e });
const money = z.number().finite().min(0);

// The banked-now balance. Monthly income/expenses are now itemized in
// finance_lines (see finance-actions.ts), which caches the derived monthly totals.
const financesPatch = z.object({ saved: money }).partial();

export async function updateFinances(weddingId: string, patch: z.infer<typeof financesPatch>): Promise<Result> {
  const p = financesPatch.safeParse(patch);
  if (!p.success || Object.keys(p.data).length === 0) return fail("Invalid values");
  const supabase = await createClient();
  const { error } = await supabase.from("budget_config").update(p.data).eq("wedding_id", weddingId);
  if (error) return fail(error.message);
  revalidatePath("/savings");
  revalidatePath("/");
  return ok;
}
