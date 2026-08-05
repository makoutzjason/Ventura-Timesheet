import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeekRange, formatDateOnly, parseDateOnly, daysInRange } from "@/lib/dates";
import { isEditableStatus } from "@/lib/timesheets";
import { TimesheetForm } from "./timesheet-form";

export default async function NewTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ timesheetId?: string }>;
}) {
  const { timesheetId: requestedTimesheetId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: traveler, error: travelerError } = await supabase
    .from("travelers")
    .select("facility_id, facilities(name, week_start_day, time_zone, skip_manager_approval)")
    .eq("id", user.id)
    .maybeSingle();

  if (travelerError) {
    console.error("[timesheets/new] traveler query error:", travelerError);
  }

  if (!traveler || !traveler.facility_id || !traveler.facilities) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900">Not set up yet</h1>
        <p className="text-sm text-zinc-600">Ask your admin to add you as a traveler.</p>
      </div>
    );
  }

  const currentFacility = traveler.facilities as unknown as {
    name: string;
    week_start_day: number;
    time_zone: string;
    skip_manager_approval: boolean;
  };

  let weekStartDate: string;
  let weekEndDate: string;
  let days: Date[];
  let timesheet: {
    id: string;
    status: string;
    flag_reason: string | null;
    guaranteed_hours_note: string | null;
  } | null;
  // Display/behavior for whichever facility this timesheet actually belongs
  // to — see the branch below for why that isn't always traveler.facilities.
  let facilityName: string;
  let facilitySkipManagerApproval: boolean;
  let facilityIdForForm: string;

  if (requestedTimesheetId) {
    // Opening a *specific* timesheet to correct — e.g. a flagged one from a
    // past week, from the "Your timesheets" list. This has to be anchored
    // to that timesheet's own stored week_start_date/week_end_date, not
    // "today" — the code below this branch assumes "the current week's
    // timesheet," which silently resolves to the wrong one whenever the
    // requested timesheet isn't from the current week (the bug this branch
    // fixes: clicking an old flagged row landed on this week's submission
    // instead, since that's what week-less "/timesheets/new" always means).
    const { data: requested } = await supabase
      .from("timesheets")
      .select(
        "id, status, week_start_date, week_end_date, flag_reason, guaranteed_hours_note, facility_id, facilities(name, skip_manager_approval)",
      )
      .eq("id", requestedTimesheetId)
      .eq("traveler_id", user.id)
      .maybeSingle();

    if (!requested) notFound();
    // Not editable (approved/paid/etc.) — same redirect the current-week
    // path below does for the same reason.
    if (!isEditableStatus(requested.status)) {
      redirect(`/timesheets/${requested.id}`);
    }

    weekStartDate = requested.week_start_date;
    weekEndDate = requested.week_end_date;
    days = daysInRange(parseDateOnly(weekStartDate));
    timesheet = requested;

    // The timesheet's own facility_id — a snapshot taken at submission time
    // (see 0001_init.sql) — not the traveler's current assignment, so
    // correcting an old timesheet doesn't silently apply today's facility
    // rules to a week worked somewhere else.
    const requestedFacility = requested.facilities as unknown as { name: string; skip_manager_approval: boolean } | null;
    facilityName = requestedFacility?.name ?? currentFacility.name;
    facilitySkipManagerApproval = requestedFacility?.skip_manager_approval ?? currentFacility.skip_manager_approval;
    facilityIdForForm = requested.facility_id;
  } else {
    const { weekStart, weekEnd, days: currentWeekDays } = getCurrentWeekRange(
      currentFacility.week_start_day,
      currentFacility.time_zone,
    );
    weekStartDate = formatDateOnly(weekStart);
    weekEndDate = formatDateOnly(weekEnd);
    days = currentWeekDays;
    facilityName = currentFacility.name;
    facilitySkipManagerApproval = currentFacility.skip_manager_approval;
    facilityIdForForm = traveler.facility_id;

    const { data: currentWeekTimesheet } = await supabase
      .from("timesheets")
      .select("id, status, flag_reason, guaranteed_hours_note")
      .eq("traveler_id", user.id)
      .eq("week_start_date", weekStartDate)
      .maybeSingle();

    // Already past the traveler's control (with a manager, admin, or paid) —
    // send them to the read-only detail view instead of an edit form.
    if (currentWeekTimesheet && !isEditableStatus(currentWeekTimesheet.status)) {
      redirect(`/timesheets/${currentWeekTimesheet.id}`);
    }

    timesheet = currentWeekTimesheet;
  }

  const existingEntries = new Map<
    string,
    {
      time_in: string | null;
      time_out: string | null;
      lunch_out: string | null;
      lunch_in: string | null;
      no_lunch: boolean;
      short_hours_reason: string | null;
      notes: string | null;
      on_call_time_in: string | null;
      on_call_time_out: string | null;
      call_back_time_in: string | null;
      call_back_time_out: string | null;
      call_back_reason: string | null;
      mileage: number | null;
    }
  >();

  if (timesheet) {
    const { data: entryRows } = await supabase
      .from("timesheet_entries")
      .select(
        "work_date, time_in, time_out, lunch_out, lunch_in, no_lunch, short_hours_reason, notes, on_call_time_in, on_call_time_out, call_back_time_in, call_back_time_out, call_back_reason, mileage",
      )
      .eq("timesheet_id", timesheet.id);

    for (const row of entryRows ?? []) {
      existingEntries.set(row.work_date, row);
    }
  }

  const dayInfos = days.map((date) => ({
    workDate: formatDateOnly(date),
    label: format(date, "EEE, MMM d"),
  }));

  // Postgres returns "time" columns as "HH:MM:SS" — trim to "HH:MM" to
  // match the <input type="time"> format.
  const trim = (value: string | null | undefined) => value?.slice(0, 5) ?? "";

  const initialEntries = dayInfos.map(({ workDate }) => {
    const existing = existingEntries.get(workDate);
    return {
      timeIn: trim(existing?.time_in),
      timeOut: trim(existing?.time_out),
      lunchOut: trim(existing?.lunch_out),
      lunchIn: trim(existing?.lunch_in),
      noLunch: existing?.no_lunch ?? false,
      shortHoursReason: existing?.short_hours_reason ?? "",
      comments: existing?.notes ?? "",
      onCallTimeIn: trim(existing?.on_call_time_in),
      onCallTimeOut: trim(existing?.on_call_time_out),
      callBackTimeIn: trim(existing?.call_back_time_in),
      callBackTimeOut: trim(existing?.call_back_time_out),
      callBackReason: existing?.call_back_reason ?? "",
      mileage: existing?.mileage != null ? String(existing.mileage) : "",
    };
  });

  let initialPhotos: { path: string; name: string }[] = [];
  if (timesheet) {
    const { data: photoRows } = await supabase
      .from("timesheet_photos")
      .select("storage_path")
      .eq("timesheet_id", timesheet.id);

    initialPhotos = (photoRows ?? []).map((row) => ({
      path: row.storage_path,
      // Path is "{travelerId}/{weekStartDate}/{timestamp}-{originalName}" —
      // show just the readable tail.
      name: row.storage_path.split("/").pop()?.replace(/^\d+-/, "") ?? row.storage_path,
    }));
  }

  const wasFlagged = timesheet?.status === "flagged";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {wasFlagged ? "Correct & resubmit" : "Submit this week"}
        </h1>
        <p className="text-sm text-zinc-600">{facilityName}</p>
        {wasFlagged && timesheet?.flag_reason && (
          <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">{timesheet.flag_reason}</p>
        )}
      </div>

      <TimesheetForm
        days={dayInfos}
        initialEntries={initialEntries}
        initialGuaranteedHoursNote={timesheet?.guaranteed_hours_note ?? ""}
        weekStartDate={weekStartDate}
        weekEndDate={weekEndDate}
        timesheetId={timesheet?.id ?? null}
        wasFlagged={wasFlagged}
        facilityId={facilityIdForForm}
        skipManagerApproval={facilitySkipManagerApproval}
        travelerId={user.id}
        initialPhotos={initialPhotos}
      />
    </div>
  );
}
