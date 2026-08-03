import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

// Shell for every traveler-facing page: a slim top bar, the page content,
// and a bottom tab bar sized for thumbs. This is the layout that will get
// installed to a phone's home screen as the PWA.
//
// Every route under this group requires a signed-in traveler — checked here
// once rather than in every page. /login lives outside this group
// specifically so this redirect can't loop back on itself.
export default async function TravelerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // A deactivated traveler still has a working login (deactivating doesn't
  // touch their auth account) — this is the actual enforcement point.
  const { data: traveler } = await supabase.from("travelers").select("active").eq("id", user.id).maybeSingle();

  if (traveler && !traveler.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-center">
        <div>
          <p className="text-sm font-medium text-zinc-900">Your account has been deactivated.</p>
          <p className="mt-1 text-sm text-zinc-600">Contact your admin if you think this is a mistake.</p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <span className="text-base font-semibold text-zinc-900">Ventura Timesheets</span>
        <SignOutButton />
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="sticky bottom-0 flex border-t border-zinc-200 bg-white">
        {/* TODO: wire up active-route highlighting once there's more than one page to distinguish */}
        <Link href="/" className="flex-1 py-3 text-center text-sm text-zinc-600">
          Home
        </Link>
        <Link href="/timesheets" className="flex-1 py-3 text-center text-sm text-zinc-600">
          Timesheets
        </Link>
      </nav>
    </div>
  );
}
