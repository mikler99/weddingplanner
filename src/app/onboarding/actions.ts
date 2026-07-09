"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CATEGORIES, STARTER_TASKS, taxForRegion } from "@/lib/wedding-defaults";

const schema = z.object({
  name: z.string().min(1).max(120),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  region: z.string().max(60),
  guest_estimate: z.number().int().min(0).max(10000),
});

// Creates a wedding and provisions everything the app assumes exists: the
// owner membership, budget config (+ region tax default), the default
// categories, and a generic starter checklist. Uses the service-role client
// because RLS has no self-insert path for weddings / wedding_members.
export async function createWedding(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    event_date: String(formData.get("event_date") ?? "").trim(),
    region: String(formData.get("region") ?? "OTHER").trim(),
    guest_estimate: parseInt(String(formData.get("guest_estimate") ?? "0"), 10),
  });
  if (!parsed.success) redirect("/onboarding?e=invalid");
  const info = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Guard against double-submit / already having a wedding.
  const existing = await supabase.from("wedding_members").select("wedding_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing.data) redirect("/");

  const admin = createAdminClient();
  const { data: wed, error } = await admin
    .from("weddings")
    .insert({
      name: info.name,
      event_date: info.event_date,
      region: info.region,
      guest_estimate: info.guest_estimate,
      guest_guarantee: info.guest_estimate,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !wed) redirect("/onboarding?e=failed");

  await admin.from("wedding_members").insert({ wedding_id: wed.id, user_id: user.id, role: "owner" });
  await admin.from("budget_config").insert({ wedding_id: wed.id, tax_rate: taxForRegion(info.region) });
  await admin.from("budget_categories").insert(DEFAULT_CATEGORIES.map((c) => ({ wedding_id: wed.id, ...c })));
  // Every wedding starts with one active plan; payments/to-dos are owned by it.
  const { data: scen } = await admin
    .from("scenarios")
    .insert({ wedding_id: wed.id, name: "Working plan", guests: info.guest_estimate, is_active: true, sort: 0 })
    .select("id")
    .single();
  await admin.from("milestones").insert(STARTER_TASKS.map((t) => ({ wedding_id: wed.id, scenario_id: scen?.id ?? null, ...t })));

  redirect("/");
}
