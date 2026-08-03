import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocalWeekdayAndHour, startOfLocalHour } from "@/lib/dates";
import { TRACK1_SCHEDULE, TRACK2_SCHEDULE } from "@/lib/reminder-schedule";
import { getTravelersMissingSubmission } from "@/lib/admin-dashboard";
import {
  sendManagerApprovalReminder,
  sendMissingSubmissionReminder,
  hasManagerReminderBeenSent,
  hasReminderLogEntry,
  logReminderSent,
} from "@/lib/reminders";

// REQUIRES HOURLY EXECUTION TO BEHAVE AS DESIGNED. Reminder times (see
// src/lib/reminder-schedule.ts) are evaluated in each *facility's own*
// local time zone, not server/UTC time — a single global trigger can't
// correctly hit "8am in every zone a facility might be in," so this needs
// to run every hour to check, for every facility, "is one of its slots due
// this hour."
//
// TEMPORARY: vercel.json currently runs this on "0 14 * * *" (once daily,
// 14:00 UTC = 8am America/Denver) instead of hourly, because Vercel's
// Hobby plan doesn't allow hourly cron and this was deployed before
// upgrading to Pro. 14:00 UTC was picked because it coincides with the
// real mon_8am/tue_8am slots in both schedules — but every other slot
// (tue_2pm, wed_7am, sat_6pm, sun_6pm) will now silently never fire, and
// even mon_8am/tue_8am only fire for facilities actually on America/Denver
// (a different facility timezone would miss 14:00 UTC entirely). This is a
// real reduction in reminder coverage, not just "slower" — restore
// vercel.json to "0 * * * *" once on Pro, and this comment can shrink back
// down to just documenting the hourly requirement.
//
// Two independent tracks, because "submitted, waiting on a manager" and
// "never submitted at all" are different problems:
//   Track 1 — nudges the facility manager to approve. Never auto-approves,
//     under any circumstance; after the final scheduled reminder, automation
//     just stops and the timesheet sits visible on the admin dashboard for a
//     human to chase.
//   Track 2 — nudges the traveler to submit, and (only once it's actually
//     overdue, not on the pre-deadline stages) separately notifies the
//     manager that their traveler hasn't submitted. Sourced from
//     getTravelersMissingSubmission — the same query the dashboard's
//     "Not submitted" view uses, not a reimplementation of it.
//
// Guarded by CRON_SECRET so this endpoint can't be triggered by anyone who
// finds the URL — Vercel Cron sends it as a Bearer token automatically once
// the env var is set; see SETUP.md.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Dev/test-only escape hatch: lets a manual run simulate a specific
  // instant (e.g. "as if it were Monday 8am America/Denver") so the actual
  // schedule-matching + send/dedup logic below can be exercised on demand,
  // instead of only ever firing for real at the scheduled hours. Ignored
  // outside development on purpose — even with the correct CRON_SECRET, a
  // deployed production instance always uses the real current time.
  const simulateNowParam = request.nextUrl.searchParams.get("simulateNow");
  let now = new Date();
  if (process.env.NODE_ENV !== "production" && simulateNowParam) {
    const parsed = new Date(simulateNowParam);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: `Invalid simulateNow value: ${simulateNowParam}` }, { status: 400 });
    }
    now = parsed;
  }

  const summary = {
    now: now.toISOString(),
    track1Sent: 0,
    track1Skipped: 0,
    track1Errors: [] as string[],
    track2TravelerSent: 0,
    track2Skipped: 0,
    track2Errors: [] as string[],
  };

  const { data: facilities, error: facilitiesError } = await admin
    .from("facilities")
    .select("id, time_zone")
    .eq("active", true);

  if (facilitiesError) {
    return NextResponse.json({ error: facilitiesError.message }, { status: 500 });
  }

  // Fetched once for the whole run, not per facility — getTravelersMissingSubmission
  // already batches across every active traveler/facility, so there's no
  // reason to re-run it inside the facility loop below.
  const { data: missingSubmissions, error: missingError } = await getTravelersMissingSubmission(admin, now);
  if (missingError) {
    summary.track2Errors.push(`getTravelersMissingSubmission: ${missingError}`);
  }

  for (const facility of facilities) {
    const { weekday, hour } = getLocalWeekdayAndHour(facility.time_zone, now);

    const track1Slot = TRACK1_SCHEDULE.find((slot) => slot.weekday === weekday && slot.hour === hour);
    if (track1Slot) {
      const slotStart = startOfLocalHour(facility.time_zone, now);

      const { data: pending } = await admin
        .from("timesheets")
        .select("id")
        .eq("facility_id", facility.id)
        .eq("status", "awaiting_manager");

      for (const timesheet of pending ?? []) {
        const alreadySent = await hasManagerReminderBeenSent(admin, timesheet.id, slotStart);
        if (alreadySent) {
          summary.track1Skipped += 1;
          continue;
        }

        const { error } = await sendManagerApprovalReminder(admin, timesheet.id, {
          type: "system",
          label: `cron:${track1Slot.stage}`,
        });
        if (error) {
          summary.track1Errors.push(`${timesheet.id}: ${error}`);
        } else {
          summary.track1Sent += 1;
        }
      }
    }

    const track2Slot = TRACK2_SCHEDULE.find((slot) => slot.weekday === weekday && slot.hour === hour);
    if (track2Slot) {
      const missingAtFacility = (missingSubmissions ?? []).filter((m) => m.facilityId === facility.id);

      for (const missing of missingAtFacility) {
        const alreadySent = await hasReminderLogEntry(
          admin,
          missing.travelerId,
          missing.weekStartDate,
          track2Slot.stage,
        );
        if (alreadySent) {
          summary.track2Skipped += 1;
          continue;
        }

        const { travelerError, managerError } = await sendMissingSubmissionReminder(admin, missing, {
          notifyManager: track2Slot.notifyManager,
        });

        if (managerError) {
          summary.track2Errors.push(`${missing.travelerId} (manager notice): ${managerError}`);
        }

        if (travelerError) {
          // Not logged — leaves this stage eligible to retry later in the
          // same local hour (still matches this slot), rather than being
          // silently skipped for the rest of the week.
          summary.track2Errors.push(`${missing.travelerId} (traveler reminder): ${travelerError}`);
        } else {
          await logReminderSent(admin, missing.travelerId, missing.weekStartDate, track2Slot.stage);
          summary.track2TravelerSent += 1;
        }
      }
    }
  }

  return NextResponse.json(summary);
}
