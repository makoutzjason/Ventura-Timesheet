"use server";

import { createClient } from "@/lib/supabase/server";

type ActionState = { message: string } | null;

const GENERIC_MESSAGE = "If that email has a pending invite, we've sent a fresh link — check your inbox.";

// Reachable from the public /login page, before anyone has a session, so it
// can't require auth and can't use the service-role client. It rides on
// Supabase's own resetPasswordForEmail (same single-use-link mechanism as
// the original invite) rather than re-inviting, since re-inviting an email
// that's already a registered auth user just errors.
//
// Every outcome — real account, no account, Supabase rate-limited it —
// returns the same message. Anything more specific would let this be used
// to enumerate which emails have accounts.
export async function resendSetPasswordLinkAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
    });
    if (error) console.error("resendSetPasswordLinkAction failed", error);
  }

  return { message: GENERIC_MESSAGE };
}
