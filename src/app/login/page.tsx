import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { InviteExpiredBanner } from "./invite-expired-banner";

// Outside the (traveler) route group deliberately: that group's layout will
// require a signed-in user, and this page is the one place that can't
// require that without creating a redirect loop.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Ventura Timesheets</h1>
          <p className="mt-1 text-sm text-zinc-600">Sign in to submit your weekly timesheet.</p>
        </div>
        {error === "invite-expired" && <InviteExpiredBanner />}
        <LoginForm />
      </div>
    </div>
  );
}
