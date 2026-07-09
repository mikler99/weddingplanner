import { createClient } from "@supabase/supabase-js";

// Service-role client — BYPASSES RLS. Server-only; never import into a Client
// Component or expose the key to the browser. Use for privileged operations
// that RLS deliberately forbids: linking wedding_members (invite/claim),
// server-side extraction writes, and the seed/admin scripts.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
