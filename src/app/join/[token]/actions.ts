"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Accept an invitation: links the signed-in user to the wedding with the invited
// role. Runs via the admin client because wedding_members has no self-insert path.
export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const admin = createAdminClient();
  const { data: inv } = await admin.from("member_invites").select("id, wedding_id, role, accepted_at").eq("token", token).maybeSingle();
  if (!inv || inv.accepted_at) redirect(`/join/${token}`); // page shows "no longer valid"

  const { data: existing } = await admin.from("wedding_members").select("role").eq("wedding_id", inv.wedding_id).eq("user_id", user.id).maybeSingle();
  if (!existing) {
    await admin.from("wedding_members").insert({ wedding_id: inv.wedding_id, user_id: user.id, role: inv.role });
  }
  await admin.from("member_invites").update({ accepted_at: new Date().toISOString(), accepted_by: user.id }).eq("id", inv.id);

  revalidatePath("/", "layout");
  redirect("/");
}
