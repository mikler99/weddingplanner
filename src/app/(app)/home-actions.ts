"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Small hub interactions — server actions, no client state. RLS (editor-write)
// gates every update, so no extra auth checks here.

export async function setBudgetTarget(weddingId: string, formData: FormData) {
  const raw = String(formData.get("target") ?? "").replace(/[^0-9.]/g, "");
  const n = raw === "" ? null : Number(raw);
  const supabase = await createClient();
  await supabase.from("weddings").update({ budget_target: n }).eq("id", weddingId);
  revalidatePath("/");
}

export async function toggleMilestone(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("milestones").update({ done }).eq("id", id);
  revalidatePath("/");
}

export async function togglePayment(id: string, paid: boolean) {
  const supabase = await createClient();
  await supabase.from("payments").update({ paid }).eq("id", id);
  revalidatePath("/");
}
