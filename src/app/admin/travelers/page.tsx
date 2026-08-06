import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PaginationControls } from "../pagination-controls";
import { SortableHeader } from "../sortable-header";

const PAGE_SIZE = 25;
const SORT_COLUMNS = ["name", "facility", "status"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

export default async function AdminTravelersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const { q, page: pageParam, sort: sortParam, dir: dirParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const sort: SortColumn = (SORT_COLUMNS as readonly string[]).includes(sortParam ?? "")
    ? (sortParam as SortColumn)
    : "name";
  const dir: "asc" | "desc" = dirParam === "desc" ? "desc" : "asc";
  const ascending = dir === "asc";

  const supabase = await createClient();

  // profiles!inner (not the default left embed) because a search term
  // filters on profiles.full_name/email below — PostgREST only lets you
  // filter on an embedded resource when it's joined as inner. Safe
  // unconditionally here (unlike facilities) since every traveler has
  // exactly one profile by hard FK, so this never excludes a row that
  // would otherwise have shown up.
  let query = supabase
    .from("travelers")
    .select("id, employee_id, discipline, active, profiles!inner(full_name, email), facilities(name)", {
      count: "exact",
    })
    .range(from, to);

  switch (sort) {
    case "facility":
      query = query.order("name", { foreignTable: "facilities", ascending, nullsFirst: false });
      break;
    case "status":
      query = query.order("active", { ascending });
      break;
    default:
      query = query.order("full_name", { foreignTable: "profiles", ascending });
  }

  const term = q?.replace(/[,()]/g, "").trim();
  if (term) {
    // Same , ( ) stripping as facilities — see that page's comment. Scoped
    // to the profiles embed via foreignTable, matching the .or() form
    // verified against embedded resources before building this.
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`, { foreignTable: "profiles" });
  }

  const { data: travelers, count, error } = await query;
  if (error) {
    console.error("AdminTravelersPage query failed", error);
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const linkParams = { q, sort, dir };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Travelers</h1>
        <Link href="/admin/travelers/new" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
          Invite traveler
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900">
          Search
        </button>
        {q && (
          <Link href="/admin/travelers" className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <SortableHeader
                pathname="/admin/travelers"
                params={{ q }}
                column="name"
                label="Name"
                currentSort={sort}
                currentDir={dir}
              />
              <th className="px-4 py-2">Email</th>
              <SortableHeader
                pathname="/admin/travelers"
                params={{ q }}
                column="facility"
                label="Facility"
                currentSort={sort}
                currentDir={dir}
              />
              <th className="px-4 py-2">Discipline</th>
              <SortableHeader
                pathname="/admin/travelers"
                params={{ q }}
                column="status"
                label="Status"
                currentSort={sort}
                currentDir={dir}
              />
            </tr>
          </thead>
          <tbody>
            {(travelers ?? []).map((traveler) => {
              const profile = traveler.profiles as unknown as { full_name: string; email: string } | null;
              const facility = traveler.facilities as unknown as { name: string } | null;
              return (
                <tr key={traveler.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    <Link href={`/admin/travelers/${traveler.id}`} className="font-medium text-zinc-900 underline">
                      {profile?.full_name ?? "(unnamed)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{profile?.email ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{facility?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{traveler.discipline ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-600">{traveler.active ? "Active" : "Inactive"}</td>
                </tr>
              );
            })}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                  Couldn&apos;t load travelers: {error.message}
                </td>
              </tr>
            )}
            {!error && !travelers?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  {q ? "No travelers match your search." : "Nothing here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls pathname="/admin/travelers" params={linkParams} page={page} totalPages={totalPages} />
    </div>
  );
}
