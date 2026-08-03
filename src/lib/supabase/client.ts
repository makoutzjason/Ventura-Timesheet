import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

// Use this in Client Components ("use client" files) — e.g. the timesheet
// submission form, login form. Reads/writes go through Row Level Security
// as the currently signed-in traveler (or nobody, if signed out).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
