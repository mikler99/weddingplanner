import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A guest's personal link. Sets a guest-context cookie (for a personalized RSVP)
// and drops them into the public site at /w/<slug>.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invite", { p_token: token });
  const row = (Array.isArray(data) ? data[0] : data) as { slug: string | null } | undefined;
  if (!row?.slug) return NextResponse.redirect(new URL("/login?e=badinvite", req.url));

  const res = NextResponse.redirect(new URL(`/w/${row.slug}`, req.url));
  res.cookies.set("guest_token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  return res;
}
