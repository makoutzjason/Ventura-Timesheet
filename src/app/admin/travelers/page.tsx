import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTravelersPage() {
  const supabase = await createClient();
  const { data: travelers } = await supabase
    .from("travelers")
    .select("id, employee_id, discipline, active, profiles(full_name), facilities(name)")
    .order("active", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Travelers</h1>
        <Link href="/admin/travelers/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
          Invite traveler
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Facility</th>
              <th className="px-4 py-2">Discipline</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(travelers ?? []).map((traveler) => {
              const profile = traveler.profiles as unknown as { full_name: string } | null;
              const facility = traveler.facilities as unknown as { name: string } | null;
              return (
                <tr key={traveler.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    <Link href={`/admin/travelers/${traveler.id}`} className="font-medium text-zinc-900 underline">
                      {profile?.full_name ?? "(unnamed)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{facility?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{traveler.discipline ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{traveler.active ? "Active" : "Inactive"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
