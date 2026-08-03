import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

// Every route under /admin requires a signed-in user whose profiles.role is
// 'admin' — checked once here rather than in every page.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 border-r border-zinc-200 bg-white px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-900">Admin</span>
          <SignOutButton />
        </div>
        <ul className="space-y-2 text-sm">
          <li><Link href="/admin" className="text-zinc-600">Dashboard</Link></li>
          <li><Link href="/admin/travelers" className="text-zinc-600">Travelers</Link></li>
          <li><Link href="/admin/facilities" className="text-zinc-600">Facilities</Link></li>
          <li><Link href="/admin/timesheets" className="text-zinc-600">Timesheets</Link></li>
          <li><Link href="/admin/payroll" className="text-zinc-600">Payroll</Link></li>
        </ul>
      </nav>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
