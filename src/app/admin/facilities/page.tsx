import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminFacilitiesPage() {
  const supabase = await createClient();
  const { data: facilities } = await supabase
    .from("facilities")
    .select("id, name, manager_email, skip_manager_approval, active")
    .order("name", { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Facilities</h1>
        <Link href="/admin/facilities/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
          Add facility
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Manager email</th>
              <th className="px-4 py-2">Photo bypass</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(facilities ?? []).map((facility) => (
              <tr key={facility.id} className="border-t border-zinc-100">
                <td className="px-4 py-2">
                  <Link href={`/admin/facilities/${facility.id}`} className="font-medium text-zinc-900 underline">
                    {facility.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600">{facility.manager_email}</td>
                <td className="px-4 py-2 text-zinc-600">{facility.skip_manager_approval ? "On" : "Off"}</td>
                <td className="px-4 py-2 text-zinc-600">{facility.active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
