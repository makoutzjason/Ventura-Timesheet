import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaginationControls } from "../pagination-controls";

const PAGE_SIZE = 25;

export default async function AdminFacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("facilities")
    .select("id, name, manager_email, skip_manager_approval, active", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  // A plain GET <form> (no JS, submits to this same page with ?q=) rather
  // than live-as-you-type — nothing else in this admin panel does
  // client-side fetching, and at "thousands of facilities" scale a
  // debounced live search would mean adding a new client-side
  // data-fetching path just for this, not simplifying anything.
  const term = q?.replace(/[,()]/g, "").trim();
  if (term) {
    // .or() takes a raw filter string, where , ( ) are syntax — stripped
    // above so a search term containing them can't malform the filter
    // (not a security issue, PostgREST still parameterizes the actual
    // match value; an unstripped term could just misparse into the wrong
    // filter shape).
    query = query.or(`name.ilike.%${term}%,manager_email.ilike.%${term}%`);
  }

  const { data: facilities, count, error } = await query;
  if (error) {
    console.error("AdminFacilitiesPage query failed", error);
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Facilities</h1>
        <Link href="/admin/facilities/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
          Add facility
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or manager email…"
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900">
          Search
        </button>
        {q && (
          <Link
            href="/admin/facilities"
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 underline"
          >
            Clear
          </Link>
        )}
      </form>

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
            {error && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-red-600">
                  Couldn&apos;t load facilities: {error.message}
                </td>
              </tr>
            )}
            {!error && !facilities?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  {q ? "No facilities match your search." : "Nothing here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls pathname="/admin/facilities" params={{ q }} page={page} totalPages={totalPages} />
    </div>
  );
}
