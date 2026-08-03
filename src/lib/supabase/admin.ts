import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Service-role client: bypasses Row Level Security entirely. This is the
// ONLY client that can read/write on behalf of the facility manager, who
// never signs in — the manager approval route (/api/approve/[token])
// verifies the one-time token itself and then uses this client to act.
//
// Never import this file from a Client Component or anything that ships to
// the browser — SUPABASE_SERVICE_ROLE_KEY must stay server-only.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
