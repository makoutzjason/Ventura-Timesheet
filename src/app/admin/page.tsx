import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly, formatWeekLabel } from "@/lib/dates";
import { getPendingApprovals, getTravelersMissingSubmission, getDashboardCounts } from "@/lib/admin-dashboard";
import { SendReminderButton } from "./send-reminder-button";

// Admin dashboard ("/admin"): the two signals the reminder system will
// later key off of — timesheets stuck waiting on a manager, and travelers
// who haven't even started this week. See src/lib/admin-dashboard.ts for
// the shared queries behind both.
export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [pendingResult, missingResult, countsResult] = await Promise.all([
    getPendingApprovals(supabase),
    getTravelersMissingSubmission(supabase),
    getDashboardCounts(supabase),
  ]);
  const { data: pendingApprovals, error: pendingError } = pendingResult;
  const { data: missingSubmissions, error: missingError } = missingResult;
  const { data: counts, error: countsError } = countsResult;

  const sortedMissing = [...missingSubmissions].sort((a, b) => a.travelerName.localeCompare(b.travelerName));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>

      {countsError ? (
        <p className="text-sm text-red-600">Couldn&apos;t load summary counts: {countsError}</p>
      ) : (
        <div className="flex gap-6">
          <p className="text-sm text-zinc-600">
            <span className="text-lg font-semibold text-zinc-900">{counts.approvedThisWeek}</span> approved this week
          </p>
          <p className="text-sm text-zinc-600">
            <span className="text-lg font-semibold text-zinc-900">{counts.paidTotal}</span> paid
          </p>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          Awaiting manager approval ({pendingApprovals.length})
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2">Traveler</th>
                <th className="px-4 py-2">Facility</th>
                <th className="px-4 py-2">Manager email</th>
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Waiting</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovals.map((row) => (
                <tr key={row.timesheetId} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    <Link href={`/timesheets/${row.timesheetId}`} className="font-medium text-zinc-900 underline">
                      {row.travelerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.facilityName}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.managerEmail}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {formatWeekLabel(parseDateOnly(row.weekStartDate), parseDateOnly(row.weekEndDate))}
                  </td>
                  <td className="px-4 py-2">
                    <span className={row.hoursWaiting >= 48 ? "font-medium text-red-600" : "text-zinc-600"}>
                      {formatDistanceToNowStrict(new Date(row.submittedAt))}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <SendReminderButton timesheetId={row.timesheetId} />
                  </td>
                </tr>
              ))}
              {pendingError && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-red-600">
                    Couldn&apos;t load pending approvals: {pendingError}
                  </td>
                </tr>
              )}
              {!pendingError && pendingApprovals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Nothing waiting on a manager.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          Not submitted this week ({sortedMissing.length})
        </h2>
        <p className="text-xs text-zinc-500">
          Active travelers with no timesheet at all yet for their facility&apos;s current week —
          not flagged, not in draft, never started.
        </p>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2">Traveler</th>
                <th className="px-4 py-2">Facility</th>
                <th className="px-4 py-2">Week</th>
              </tr>
            </thead>
            <tbody>
              {sortedMissing.map((row) => (
                <tr key={row.travelerId} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    <Link href={`/admin/travelers/${row.travelerId}`} className="font-medium text-zinc-900 underline">
                      {row.travelerName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.facilityName}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {formatWeekLabel(parseDateOnly(row.weekStartDate), parseDateOnly(row.weekEndDate))}
                  </td>
                </tr>
              ))}
              {missingError && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-red-600">
                    Couldn&apos;t load submission status: {missingError}
                  </td>
                </tr>
              )}
              {!missingError && sortedMissing.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                    Everyone active has started this week&apos;s timesheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
