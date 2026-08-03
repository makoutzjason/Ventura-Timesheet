import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

// Use this in Server Components, Server Actions, and Route Handlers. Same
// RLS behavior as the browser client (still scoped to the signed-in
// traveler/admin) — the difference is only where it runs and how it reads
// the session (from cookies instead of browser storage).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignored: happens when called from a Server Component, which
            // can't set cookies. Session refresh is handled by
            // src/middleware.ts instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}
