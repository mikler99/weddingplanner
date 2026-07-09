"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1).max(120),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue_name: z.string().max(200).nullable(),
  venue_address: z.string().max(300).nullable(),
  guest_estimate: z.number().int().min(0).max(10000),
  guest_guarantee: z.number().int().min(0).max(10000),
  region: z.string().max(60),
  budget_target: z.number().min(0).nullable(),
  tax_rate: z.number().min(0).max(1),
});

// Everything here connects downstream: changing the date re-derives payment due
// dates and the countdown; guest count re-derives per-guest costs; tax re-derives
// every taxable line — all at render.
export async function updateWeddingInfo(weddingId: string, formData: FormData): Promise<void> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const numOrNull = (k: string) => {
    const v = str(k).replace(/[^0-9.]/g, "");
    return v === "" ? null : Number(v);
  };
  const parsed = schema.safeParse({
    name: str("name"),
    event_date: str("event_date"),
    venue_name: str("venue_name") || null,
    venue_address: str("venue_address") || null,
    guest_estimate: parseInt(str("guest_estimate") || "0", 10),
    guest_guarantee: parseInt(str("guest_guarantee") || "0", 10),
    region: str("region"),
    budget_target: numOrNull("budget_target"),
    tax_rate: Number((parseFloat(str("tax_rate")) || 0) / 100),
  });
  if (!parsed.success) return; // form re-renders unchanged on invalid input

  const { tax_rate, ...wedding } = parsed.data;
  const supabase = await createClient();
  await supabase.from("weddings").update(wedding).eq("id", weddingId);
  await supabase.from("budget_config").update({ tax_rate }).eq("wedding_id", weddingId);

  revalidatePath("/", "layout"); // date/guests/tax ripple across every page
}
