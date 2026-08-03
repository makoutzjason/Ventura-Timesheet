import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the traveler/admin's auth session on every request so Server
// Components always see an up-to-date sign-in state. This is Supabase's
// standard Next.js middleware pattern — see src/proxy.ts for where
// it's wired in.
export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  // Before .env.local has real Supabase credentials (e.g. right after
  // scaffolding, per SETUP.md), skip session handling instead of crashing
  // every request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  return updateSessionWithSupabase(request, supabaseResponse);
}

async function updateSessionWithSupabase(request: NextRequest, initialResponse: NextResponse) {
  let supabaseResponse = initialResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this call is what actually refreshes an expiring token.
  await supabase.auth.getUser();

  return supabaseResponse;
}
