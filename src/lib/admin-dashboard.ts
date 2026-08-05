import { differenceInHours } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getCurrentWeekRange, formatDateOnly } from "@/lib/dates";

// Shared by the admin dashboard today and, later, the reminder cron
// (src/app/api/cron/reminders/route.ts) — both need the exact same answers
// to "how long has this been pending" and "who hasn't submitted," so that
// logic lives here once instead of being duplicated (and drifting) between
// a page and a cron job. Takes whichever Supabase client the caller already
// has — the admin dashboard passes the cookie-scoped RLS client, the cron
// route (no user session to scope to) will pass the service-role client.

export type PendingApproval = {
  timesheetId: string;
  travelerName: string;
  facilityId: string;
  facilityName: string;
  managerEmail: string;
  weekStartDate: string;
  weekEndDate: string;
  submittedAt: string;
  hoursWaiting: number;
};

// Every timesheet sitting in "awaiting_manager", oldest submission first.
// hoursWaiting is a plain number (not a formatted string) specifically so
// the reminder cron can threshold on it (e.g. "nudge after 48h") without
// having to re-derive it from submittedAt itself.
//
// Returns { data, error } rather than throwing — a real query failure (bad
// grants, a broken RLS policy) should render as a visible inline error on
// the dashboard, the same way /admin/timesheets does, not crash the page.
export async function getPendingApprovals(
  supabase: SupabaseClient<Database>,
  referenceDate: Date = new Date(),
): Promise<{ data: PendingApproval[]; error: string | null }> {
  const { data, error } = await supabase
    .from("timesheets")
    .select(
      "id, submitted_at, week_start_date, week_end_date, travelers(profiles(full_name)), facilities(id, name, manager_email)",
    )
    .eq("status", "awaiting_manager")
    .order("submitted_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("getPendingApprovals query failed", error);
    return { data: [], error: error.message };
  }

  const mapped = data.map((row) => {
    const traveler = row.travelers as unknown as { profiles: { full_name: string } | null } | null;
    const facility = row.facilities as unknown as { id: string; name: string; manager_email: string } | null;
    // submitted_at is set in the same update that moves status to
    // awaiting_manager (see timesheets/new/actions.ts), so it's never null
    // for a row that matched that status filter.
    const submittedAt = row.submitted_at as string;

    return {
      timesheetId: row.id,
      travelerName: traveler?.profiles?.full_name ?? "—",
      facilityId: facility?.id ?? "",
      facilityName: facility?.name ?? "—",
      managerEmail: facility?.manager_email ?? "—",
      weekStartDate: row.week_start_date,
      weekEndDate: row.week_end_date,
      submittedAt,
      hoursWaiting: differenceInHours(referenceDate, new Date(submittedAt)),
    };
  });

  return { data: mapped, error: null };
}

export type MissingSubmission = {
  travelerId: string;
  travelerName: string;
  facilityId: string;
  facilityName: string;
  managerEmail: string;
  weekStartDate: string;
  weekEndDate: string;
};

// Active travelers with no timesheet row at all — not draft, not anything —
// for the current week *as their own facility's week_start_day/time_zone
// defines it*. Different facilities can be on different weeks (different
// start day) and different clocks (different zone) at the same instant, so
// "current week" has to be computed per traveler via getCurrentWeekRange,
// not once globally.
export async function getTravelersMissingSubmission(
  supabase: SupabaseClient<Database>,
  referenceDate: Date = new Date(),
): Promise<{ data: MissingSubmission[]; error: string | null }> {
  const { data: travelers, error } = await supabase
    .from("travelers")
    .select("id, active, profiles(full_name), facilities(id, name, week_start_day, time_zone, manager_email)")
    .eq("active", true);

  if (error) {
    console.error("getTravelersMissingSubmission travelers query failed", error);
    return { data: [], error: error.message };
  }

  const withFacility = travelers.filter(
    (traveler): traveler is typeof traveler & { facilities: NonNullable<typeof traveler.facilities> } =>
      Boolean(traveler.facilities),
  );

  const expected = withFacility.map((traveler) => {
    const facility = traveler.facilities as unknown as {
      id: string;
      name: string;
      week_start_day: number;
      time_zone: string;
      manager_email: string;
    };
    const profile = traveler.profiles as unknown as { full_name: string } | null;
    const { weekStart, weekEnd } = getCurrentWeekRange(facility.week_start_day, facility.time_zone, referenceDate);

    return {
      travelerId: traveler.id as string,
      travelerName: profile?.full_name ?? "—",
      facilityId: facility.id,
      facilityName: facility.name,
      managerEmail: facility.manager_email,
      weekStartDate: formatDateOnly(weekStart),
      weekEndDate: formatDateOnly(weekEnd),
    };
  });

  if (expected.length === 0) return { data: [], error: null };

  // A single query covering every traveler's window, rather than one query
  // per traveler — bounded below by the earliest week_start_date any
  // traveler in the batch could have, since facilities can be on different
  // weeks at the same instant.
  const earliestWeekStart = expected.reduce(
    (min, t) => (t.weekStartDate < min ? t.weekStartDate : min),
    expected[0].weekStartDate,
  );

  const { data: recentTimesheets, error: timesheetsError } = await supabase
    .from("timesheets")
    .select("traveler_id, week_start_date")
    .in(
      "traveler_id",
      expected.map((t) => t.travelerId),
    )
    .gte("week_start_date", earliestWeekStart);

  if (timesheetsError) {
    console.error("getTravelersMissingSubmission timesheets query failed", timesheetsError);
    return { data: [], error: timesheetsError.message };
  }

  const hasSubmission = new Set(
    (recentTimesheets ?? []).map((row) => `${row.traveler_id}|${row.week_start_date}`),
  );

  const missing = expected.filter((t) => !hasSubmission.has(`${t.travelerId}|${t.weekStartDate}`));
  return { data: missing, error: null };
}

// Every active facility's own current week_start_date, keyed by facility id
// — "current week" is per-facility (week_start_day + time_zone both vary),
// so anything that needs to test "is this row from the current week"
// against a facility_id needs this map rather than a single global date.
// Shared by getDashboardCounts below and the admin timesheets archive
// (src/app/admin/timesheets/page.tsx), which was duplicating this same
// facilities-query-plus-getCurrentWeekRange-map pattern before this existed.
export async function getCurrentWeekStartsByFacility(
  supabase: SupabaseClient<Database>,
  referenceDate: Date = new Date(),
): Promise<{ data: Map<string, string>; error: string | null }> {
  const { data: facilities, error } = await supabase.from("facilities").select("id, week_start_day, time_zone");

  if (error) {
    console.error("getCurrentWeekStartsByFacility query failed", error);
    return { data: new Map(), error: error.message };
  }

  const map = new Map(
    facilities.map((facility) => [
      facility.id as string,
      formatDateOnly(getCurrentWeekRange(facility.week_start_day, facility.time_zone, referenceDate).weekStart),
    ]),
  );

  return { data: map, error: null };
}

export type DashboardCounts = {
  approvedThisWeek: number;
  paidTotal: number;
};

// "Approved this week" is scoped per facility, same as the missing-
// submission query above — a timesheet counts as "this week" only if its
// week_start_date matches what getCurrentWeekRange computes as *that
// facility's* current week right now, not a single global week. "Paid" has
// no week attached to it here (payroll runs on its own cadence, not weekly),
// so it's a plain running total.
export async function getDashboardCounts(
  supabase: SupabaseClient<Database>,
  referenceDate: Date = new Date(),
): Promise<{ data: DashboardCounts; error: string | null }> {
  const { data: currentWeekStartByFacility, error: facilitiesError } = await getCurrentWeekStartsByFacility(
    supabase,
    referenceDate,
  );

  if (facilitiesError) {
    return { data: { approvedThisWeek: 0, paidTotal: 0 }, error: facilitiesError };
  }

  const { data: approved, error: approvedError } = await supabase
    .from("timesheets")
    .select("facility_id, week_start_date")
    .eq("status", "approved");

  if (approvedError) {
    console.error("getDashboardCounts approved query failed", approvedError);
    return { data: { approvedThisWeek: 0, paidTotal: 0 }, error: approvedError.message };
  }

  const approvedThisWeek = approved.filter(
    (row) => currentWeekStartByFacility.get(row.facility_id) === row.week_start_date,
  ).length;

  const { count: paidTotal, error: paidError } = await supabase
    .from("timesheets")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid");

  if (paidError) {
    console.error("getDashboardCounts paid query failed", paidError);
    return { data: { approvedThisWeek, paidTotal: 0 }, error: paidError.message };
  }

  return { data: { approvedThisWeek, paidTotal: paidTotal ?? 0 }, error: null };
}
