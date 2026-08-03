import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly, formatWeekLabel } from "@/lib/dates";
import { STATUS_LABELS } from "@/lib/timesheets";
import { getTravelersMissingSubmission } from "@/lib/admin-dashboard";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  // Not a real timesheets.status value — this tab queries for the absence
  // of a row (see getTravelersMissingSubmission) rather than filtering
  // existing ones, so it's handled as a separate branch below instead of an
  // .eq("status", ...) like every other tab.
  { value: "not_submitted", label: "Not submitted" },
  { value: "awaiting_manager", label: "Awaiting manager" },
  // "photo_submitted" is the underlying status value (see 0001_init.sql) —
  // only the display label changed to match the business's preferred term.
  { value: "photo_submitted", label: "Vendor Timesheet" },
  { value: "flagged", label: "Flagged" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
];

type DisplayRow = {
  key: string;
  travelerName: string;
  travelerHref: string;
  facilityName: string;
  weekLabel: string;
  statusLabel: string;
};

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let rows: DisplayRow[] = [];
  let error: string | null = null;

  if (status === "not_submitted") {
    const { data: missing, error: missingError } = await getTravelersMissingSubmission(supabase);
    error = missingError;
    rows = missing.map((traveler) => ({
      key: `${traveler.travelerId}-${traveler.weekStartDate}`,
      travelerName: traveler.travelerName,
      travelerHref: `/admin/travelers/${traveler.travelerId}`,
      facilityName: traveler.facilityName,
      weekLabel: formatWeekLabel(parseDateOnly(traveler.weekStartDate), parseDateOnly(traveler.weekEndDate)),
      statusLabel: "Not submitted",
    }));
  } else {
    // profiles isn't embeddable directly off timesheets — there's no FK
    // between them. The actual path is timesheets.traveler_id ->
    // travelers.id -> profiles.id, so the traveler's name has to be
    // embedded two hops out through travelers.
    let query = supabase
      .from("timesheets")
      .select(
        "id, week_start_date, week_end_date, status, submitted_at, travelers(profiles(full_name)), facilities(name)",
      )
      .order("submitted_at", { ascending: false, nullsFirst: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: timesheets, error: queryError } = await query;
    if (queryError) {
      // Surfaces real problems (missing grants, a broken RLS policy, etc.)
      // instead of rendering the same "Nothing here." empty state a
      // genuinely empty table would show — those two cases used to be
      // indistinguishable.
      console.error("AdminTimesheetsPage query failed", queryError);
      error = queryError.message;
    }

    rows = (timesheets ?? []).map((timesheet) => {
      const traveler = timesheet.travelers as unknown as { profiles: { full_name: string } | null } | null;
      const facility = timesheet.facilities as unknown as { name: string } | null;
      return {
        key: timesheet.id,
        travelerName: traveler?.profiles?.full_name ?? "—",
        travelerHref: `/timesheets/${timesheet.id}`,
        facilityName: facility?.name ?? "—",
        weekLabel: formatWeekLabel(parseDateOnly(timesheet.week_start_date), parseDateOnly(timesheet.week_end_date)),
        statusLabel: STATUS_LABELS[timesheet.status] ?? timesheet.status,
      };
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Timesheets</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/admin/timesheets?status=${filter.value}` : "/admin/timesheets"}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              (status ?? "") === filter.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 text-zinc-600"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2">Traveler</th>
              <th className="px-4 py-2">Facility</th>
              <th className="px-4 py-2">Week</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-zinc-100">
                <td className="px-4 py-2">
                  <Link href={row.travelerHref} className="font-medium text-zinc-900 underline">
                    {row.travelerName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600">{row.facilityName}</td>
                <td className="px-4 py-2 text-zinc-600">{row.weekLabel}</td>
                <td className="px-4 py-2 text-zinc-600">{row.statusLabel}</td>
              </tr>
            ))}
            {error && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-red-600">
                  Couldn&apos;t load timesheets: {error}
                </td>
              </tr>
            )}
            {!error && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
