import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeekRange, formatDateOnly, formatWeekLabel } from "@/lib/dates";
import { STATUS_LABELS, isEditableStatus } from "@/lib/timesheets";

export default async function TravelerHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (traveler) layout already redirects signed-out visitors to /login,
  // but layout and page data-fetching can run concurrently — this is the
  // page's own safety net so it never runs a query with a null user id.
  if (!user) redirect("/login");

  const { data: traveler, error: travelerError } = await supabase
    .from("travelers")
    .select("facility_id, active, facilities(name, week_start_day, time_zone, skip_manager_approval)")
    .eq("id", user.id)
    .maybeSingle();

  if (travelerError) {
    console.error("[home] travelers query error:", travelerError);
  }

  if (!traveler || !traveler.facilities) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900">Welcome</h1>
        <p className="text-sm text-zinc-600">
          Your account isn&apos;t set up as a traveler yet. Ask your admin to add you and assign
          you to a facility.
        </p>
      </div>
    );
  }

  const facility = traveler.facilities as unknown as {
    name: string;
    week_start_day: number;
    time_zone: string;
    skip_manager_approval: boolean;
  };

  const { weekStart, weekEnd } = getCurrentWeekRange(facility.week_start_day, facility.time_zone);
  const weekStartDate = formatDateOnly(weekStart);

  const { data: timesheet } = await supabase
    .from("timesheets")
    .select("id, status, flag_reason")
    .eq("traveler_id", user.id)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  const status = timesheet?.status ?? null;
  const ctaLabel = !status ? "Start this week's timesheet" : isEditableStatus(status) ? "Continue" : "View";
  // timesheet here is already this week's row (or none), so this is never
  // ambiguous the way a list of every week would be — but passing the id
  // explicitly when one exists keeps this consistent with the "Your
  // timesheets" list, which has to pass it for correctness (see that page).
  const ctaHref = !status
    ? "/timesheets/new"
    : isEditableStatus(status)
      ? `/timesheets/new?timesheetId=${timesheet!.id}`
      : `/timesheets/${timesheet!.id}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">This week</h1>
        <p className="text-sm text-zinc-600">{facility.name}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-900">{formatWeekLabel(weekStart, weekEnd)}</p>
        <p className="mt-1 text-sm text-zinc-600">
          {status ? STATUS_LABELS[status] : "Not submitted yet"}
        </p>
        {status === "flagged" && timesheet?.flag_reason && (
          <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
            {timesheet.flag_reason}
          </p>
        )}
        <Link
          href={ctaHref}
          className="mt-4 block rounded-md bg-zinc-900 py-2.5 text-center text-sm font-medium text-white"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
