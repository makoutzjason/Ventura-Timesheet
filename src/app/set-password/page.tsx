import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

// Reached via the invite-email link. Supabase's invite flow signs the
// traveler in immediately on click (no password set yet) — without this
// page they'd never get to choose one, and couldn't sign in again after
// this session ends.
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means the link that got them here was already used (e.g.
  // opened on a device without access to this app first) or has expired —
  // Supabase invite/recovery links are single-use. Send them to /login with
  // a reason code so it can explain what happened and offer a fresh link,
  // instead of silently dropping them at a bare login form.
  if (!user) redirect("/login?error=invite-expired");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Set your password</h1>
          <p className="mt-1 text-sm text-zinc-600">Choose a password to finish setting up your account.</p>
        </div>
        <SetPasswordForm />
      </div>
    </div>
  );
}
