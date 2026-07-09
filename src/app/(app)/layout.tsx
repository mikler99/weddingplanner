import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/wedding";
import { Shell } from "./Shell";

// Layout for all signed-in pages: enforces membership once and wraps every
// page in the shared app shell (top nav + theme toggle). Login/auth routes
// live outside this group and get no shell.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { wedding_id, role } = await requireMembership();
  const supabase = await createClient();
  const { data: wedding } = await supabase
    .from("weddings")
    .select("name, event_date")
    .eq("id", wedding_id)
    .single();

  return (
    <Shell weddingName={wedding?.name ?? "Our Wedding"} eventDate={wedding?.event_date ?? null} role={role}>
      {children}
    </Shell>
  );
}
