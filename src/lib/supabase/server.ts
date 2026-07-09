import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Request-scoped Supabase client for Server Components / Server Actions / route
// handlers. Runs as the signed-in user (anon key + their session cookie), so
// every query is subject to RLS — this is the client the app reads/writes with.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (cookies are read-only there).
            // Safe to ignore — middleware refreshes the session cookie.
          }
        },
      },
    }
  );
}
