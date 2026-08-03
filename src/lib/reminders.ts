import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateApprovalToken } from "@/lib/tokens";
import { sendApprovalRequestEmail } from "@/lib/email/send-approval-request";
import { sendSubmitReminderEmail } from "@/lib/email/send-submit-reminder";
import { sendTravelerMissingNoticeEmail } from "@/lib/email/send-traveler-missing-notice";
import { formatWeekLabel, parseDateOnly } from "@/lib/dates";
import type { MissingSubmission } from "@/lib/admin-dashboard";

// The one place that actually sends a Track 1 (manager approval) reminder —
// shared by the manual "Send reminder" button (src/app/admin/actions.ts)
// and the automated cron (src/app/api/cron/reminders/route.ts), so there's
// exactly one implementation to keep correct, not two that can drift.
//
// Always mints a brand-new approval_tokens row rather than trying to reuse
// the original — the original's raw token is stored only as a SHA-256
// hash (src/lib/tokens.ts) and genuinely can't be recovered. The original
// link is left completely untouched (not expired, not marked used); this
// just adds a second valid one.
export async function sendManagerApprovalReminder(
  admin: SupabaseClient<Database>,
  timesheetId: string,
  actor: { type: "admin" | "system"; id?: string; label?: string },
): Promise<{ error: string | null }> {
  const { data: timesheet } = await admin
    .from("timesheets")
    .select(
      "id, status, week_start_date, week_end_date, travelers(profiles(full_name)), facilities(name, manager_email)",
    )
    .eq("id", timesheetId)
    .maybeSingle();

  if (!timesheet || timesheet.status !== "awaiting_manager") {
    return { error: "This timesheet is no longer awaiting manager approval." };
  }

  const facility = timesheet.facilities as unknown as { name: string; manager_email: string } | null;
  const traveler = timesheet.travelers as unknown as { profiles: { full_name: string } | null } | null;

  if (!facility?.manager_email) {
    return { error: "This facility has no manager email on file." };
  }

  const { token, tokenHash } = generateApprovalToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await admin.from("approval_tokens").insert({
    timesheet_id: timesheetId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (tokenError) return { error: tokenError.message };

  const approveUrl = `${process.env.NEXT_PUBLIC_APP_URL}/approve/${token}`;
  const weekLabel = formatWeekLabel(parseDateOnly(timesheet.week_start_date), parseDateOnly(timesheet.week_end_date));

  try {
    await sendApprovalRequestEmail({
      to: facility.manager_email,
      travelerName: traveler?.profiles?.full_name ?? "A traveler",
      facilityName: facility.name,
      weekLabel,
      approveUrl,
    });
  } catch (error) {
    return { error: `Couldn't send the reminder email: ${error instanceof Error ? error.message : "unknown error"}` };
  }

  await admin.from("timesheet_events").insert({
    timesheet_id: timesheetId,
    event_type: "manager_reminder_sent",
    actor_type: actor.type,
    actor_id: actor.id ?? null,
    actor_label: actor.label ?? null,
    note: facility.manager_email,
  });

  return { error: null };
}

// Track 2 (traveler never submitted at all) — sends the traveler's own
// nudge, and — only when this schedule stage calls for it (see
// src/lib/reminder-schedule.ts; the pre-deadline Sat/Sun stages don't) —
// a separate notice to the facility manager.
//
// Returns the two outcomes independently rather than a single error: the
// cron needs to know specifically whether the *traveler's* reminder
// succeeded to decide whether to log this stage as done (see
// hasReminderLogEntry/logReminderSent below) — a failed manager notice
// alone shouldn't cause the traveler to get re-emailed on the next hourly
// tick within the same slot.
export async function sendMissingSubmissionReminder(
  admin: SupabaseClient<Database>,
  missing: MissingSubmission,
  options: { notifyManager: boolean },
): Promise<{ travelerError: string | null; managerError: string | null }> {
  const weekLabel = formatWeekLabel(parseDateOnly(missing.weekStartDate), parseDateOnly(missing.weekEndDate));

  const { data: authUser } = await admin.auth.admin.getUserById(missing.travelerId);
  const travelerEmail = authUser?.user?.email;

  if (!travelerEmail) {
    return { travelerError: "Traveler has no email on file.", managerError: null };
  }

  let travelerError: string | null = null;
  try {
    await sendSubmitReminderEmail({ to: travelerEmail, facilityName: missing.facilityName, weekLabel });
  } catch (error) {
    travelerError = error instanceof Error ? error.message : "unknown error";
  }

  let managerError: string | null = null;
  if (options.notifyManager) {
    if (!missing.managerEmail) {
      managerError = "This facility has no manager email on file.";
    } else {
      try {
        await sendTravelerMissingNoticeEmail({
          to: missing.managerEmail,
          travelerName: missing.travelerName,
          facilityName: missing.facilityName,
          weekLabel,
        });
      } catch (error) {
        managerError = error instanceof Error ? error.message : "unknown error";
      }
    }
  }

  return { travelerError, managerError };
}

// Dedup for Track 1: has a manager_reminder_sent event already been logged
// for this timesheet since the given instant (the start of the current
// facility-local hour — see startOfLocalHour in src/lib/dates.ts)? The cron
// runs hourly and matches on local hour, so this is what stops a retry or
// overlapping invocation within that same hour from sending a duplicate.
export async function hasManagerReminderBeenSent(
  admin: SupabaseClient<Database>,
  timesheetId: string,
  since: Date,
): Promise<boolean> {
  const { data } = await admin
    .from("timesheet_events")
    .select("id")
    .eq("timesheet_id", timesheetId)
    .eq("event_type", "manager_reminder_sent")
    .gte("created_at", since.toISOString())
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

// Dedup for Track 2: has this traveler already been sent *this specific
// stage's* reminder for the current week? Unlike Track 1, there's no
// timesheet row to hang an event on when nothing was submitted, so this
// uses reminder_log instead (see 0009_reminder_log_stages.sql).
export async function hasReminderLogEntry(
  admin: SupabaseClient<Database>,
  travelerId: string,
  weekStartDate: string,
  stage: string,
): Promise<boolean> {
  const { data } = await admin
    .from("reminder_log")
    .select("id")
    .eq("traveler_id", travelerId)
    .eq("week_start_date", weekStartDate)
    .eq("stage", stage)
    .maybeSingle();

  return Boolean(data);
}

export async function logReminderSent(
  admin: SupabaseClient<Database>,
  travelerId: string,
  weekStartDate: string,
  stage: string,
) {
  await admin.from("reminder_log").insert({ traveler_id: travelerId, week_start_date: weekStartDate, stage });
}
