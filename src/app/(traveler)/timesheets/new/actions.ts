"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timesheetSubmissionSchema } from "@/lib/validations/timesheet";
import { generateApprovalToken } from "@/lib/tokens";
import { sendApprovalRequestEmail } from "@/lib/email/send-approval-request";
import { formatWeekLabel, parseDateOnly } from "@/lib/dates";
import { needsLunchResolution, needsGuaranteedHoursReason, calculateGuaranteedHoursTotal } from "@/lib/timesheets";

type WeekContext = {
  facilityId: string;
  guaranteedHours: number | null;
  weekStartDate: string;
  weekEndDate: string;
  workDates: string[];
  timesheetId: string | null;
  wasFlagged: boolean;
};

type ActionState = { error: string } | null;

// Bound with the week's context (via .bind in the client component) so this
// stays a single action for both "Save draft" and "Submit" — the clicked
// button's name="intent" tells us which, per HTML's normal form semantics.
export async function saveTimesheetAction(
  context: WeekContext,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const intent = formData.get("intent") === "submit" ? "submit" : "draft";

  // work_date comes from context (server-computed), not the form, so a
  // tampered hidden field can't misfile an entry under the wrong date.
  const rawDays = context.workDates.map((workDate, index) => ({
    workDate,
    timeIn: String(formData.get(`days.${index}.timeIn`) ?? ""),
    timeOut: String(formData.get(`days.${index}.timeOut`) ?? ""),
    lunchOut: String(formData.get(`days.${index}.lunchOut`) ?? ""),
    lunchIn: String(formData.get(`days.${index}.lunchIn`) ?? ""),
    noLunch: formData.get(`days.${index}.noLunch`) === "true",
    shortHoursReason: String(formData.get(`days.${index}.shortHoursReason`) ?? ""),
    comments: String(formData.get(`days.${index}.comments`) ?? ""),
    onCallTimeIn: String(formData.get(`days.${index}.onCallTimeIn`) ?? ""),
    onCallTimeOut: String(formData.get(`days.${index}.onCallTimeOut`) ?? ""),
    callBackTimeIn: String(formData.get(`days.${index}.callBackTimeIn`) ?? ""),
    callBackTimeOut: String(formData.get(`days.${index}.callBackTimeOut`) ?? ""),
    callBackReason: String(formData.get(`days.${index}.callBackReason`) ?? ""),
    mileage: formData.get(`days.${index}.mileage`) || 0,
  }));

  const parsed = timesheetSubmissionSchema.safeParse({
    days: rawDays,
    guaranteedHoursNote: String(formData.get("guaranteedHoursNote") ?? ""),
    guaranteedHoursReason: String(formData.get("guaranteedHoursReason") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the highlighted fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let timesheetId = context.timesheetId;

  if (timesheetId) {
    // Re-check status here rather than trusting context.wasFlagged — that
    // was true when the page loaded, but could be stale (e.g. two tabs open).
    const { data: current } = await supabase
      .from("timesheets")
      .select("status")
      .eq("id", timesheetId)
      .single();

    if (!current || (current.status !== "draft" && current.status !== "flagged")) {
      return { error: "This timesheet can no longer be edited." };
    }

    const { error: updateError } = await supabase
      .from("timesheets")
      .update({
        status: "draft",
        guaranteed_hours_note: parsed.data.guaranteedHoursNote || null,
        guaranteed_hours_reason: parsed.data.guaranteedHoursReason || null,
      })
      .eq("id", timesheetId);
    if (updateError) return { error: updateError.message };
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("timesheets")
      .insert({
        traveler_id: user.id,
        facility_id: context.facilityId,
        guaranteed_hours: context.guaranteedHours,
        week_start_date: context.weekStartDate,
        week_end_date: context.weekEndDate,
        status: "draft",
        guaranteed_hours_note: parsed.data.guaranteedHoursNote || null,
        guaranteed_hours_reason: parsed.data.guaranteedHoursReason || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { error: insertError?.message ?? "Could not create timesheet." };
    }
    timesheetId = inserted.id;
  }

  // Simplest correct way to keep 7 day-rows in sync with the form: replace
  // them wholesale rather than diffing which days changed.
  await supabase.from("timesheet_entries").delete().eq("timesheet_id", timesheetId);
  const { error: entriesError } = await supabase.from("timesheet_entries").insert(
    parsed.data.days.map((day) => ({
      timesheet_id: timesheetId,
      work_date: day.workDate,
      time_in: day.timeIn || null,
      time_out: day.timeOut || null,
      lunch_out: day.lunchOut || null,
      lunch_in: day.lunchIn || null,
      no_lunch: day.noLunch,
      short_hours_reason: day.shortHoursReason || null,
      notes: day.comments || null,
      on_call_time_in: day.onCallTimeIn || null,
      on_call_time_out: day.onCallTimeOut || null,
      call_back_time_in: day.callBackTimeIn || null,
      call_back_time_out: day.callBackTimeOut || null,
      call_back_reason: day.callBackReason || null,
      mileage: day.mileage || null,
    })),
  );
  if (entriesError) return { error: entriesError.message };

  const { data: facility } = await supabase
    .from("facilities")
    .select("name, manager_email, skip_manager_approval")
    .eq("id", context.facilityId)
    .single();

  // Entries are already saved above regardless of outcome, so a failed
  // check here doesn't lose the traveler's input — it only blocks the
  // status transition below. No default lunch deduction: every worked day
  // must be explicitly resolved (real times, or "No lunch") before submitting.
  if (intent === "submit") {
    const unresolvedDays = parsed.data.days.filter((day) =>
      needsLunchResolution(day.timeIn, day.timeOut, day.lunchOut, day.lunchIn, day.noLunch),
    );
    if (unresolvedDays.length > 0) {
      const dayLabels = unresolvedDays.map((day) => format(parseDateOnly(day.workDate), "EEE, MMM d")).join("; ");
      return { error: `Enter lunch times or check "No lunch" before submitting for: ${dayLabels}.` };
    }

    const totalHours = calculateGuaranteedHoursTotal(parsed.data.days);
    if (needsGuaranteedHoursReason(context.guaranteedHours, totalHours) && !parsed.data.guaranteedHoursReason) {
      return { error: "Select a reason for not meeting guaranteed hours before submitting." };
    }
  }

  const photoPaths = formData.getAll("photoPaths").map(String).filter(Boolean);

  if (intent === "submit" && facility?.skip_manager_approval && photoPaths.length === 0) {
    return { error: "Upload at least one photo of your clock-in/out record before submitting." };
  }

  // Photos are uploaded directly to Storage by the browser (see
  // PhotoUploadField) — this just records which paths belong to this
  // timesheet, same replace-wholesale approach as the day entries above.
  await supabase.from("timesheet_photos").delete().eq("timesheet_id", timesheetId);
  if (photoPaths.length > 0) {
    const { error: photosError } = await supabase.from("timesheet_photos").insert(
      photoPaths.map((path) => ({ timesheet_id: timesheetId, storage_path: path })),
    );
    if (photosError) return { error: photosError.message };
  }

  if (intent === "draft") {
    revalidatePath("/");
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Bypass facilities skip the manager entirely — straight to admin review,
  // no intermediate "waiting on a photo" state, since the photo is already
  // attached in this same submission.
  const nextStatus = facility?.skip_manager_approval ? "photo_submitted" : "awaiting_manager";

  const { error: statusError } = await supabase
    .from("timesheets")
    .update({ status: nextStatus, submitted_at: new Date().toISOString() })
    .eq("id", timesheetId);
  if (statusError) return { error: statusError.message };

  // timesheet_events and approval_tokens have no RLS policy for a regular
  // signed-in user (see the migration) — only the service-role client can
  // write to them, which is why we switch clients for the rest of this.
  const admin = createAdminClient();

  await admin.from("timesheet_events").insert({
    timesheet_id: timesheetId,
    event_type: context.wasFlagged ? "resubmitted" : "submitted",
    actor_type: "traveler",
    actor_id: user.id,
    actor_label: profile?.full_name ?? null,
    note: facility?.skip_manager_approval ? `${photoPaths.length} photo(s) attached` : null,
  });

  if (!facility?.skip_manager_approval && facility?.manager_email) {
    const { token, tokenHash } = generateApprovalToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await admin.from("approval_tokens").insert({
      timesheet_id: timesheetId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const approveUrl = `${process.env.NEXT_PUBLIC_APP_URL}/approve/${token}`;
    const weekLabel = formatWeekLabel(
      parseDateOnly(context.weekStartDate),
      parseDateOnly(context.weekEndDate),
    );

    try {
      await sendApprovalRequestEmail({
        to: facility.manager_email,
        travelerName: profile?.full_name ?? "A traveler",
        facilityName: facility.name,
        weekLabel,
        approveUrl,
      });
      await admin.from("timesheet_events").insert({
        timesheet_id: timesheetId,
        event_type: "sent_to_manager",
        actor_type: "system",
        actor_label: facility.manager_email,
      });
    } catch (error) {
      // The traveler's submission itself succeeded — a failed email (e.g.
      // Resend isn't configured yet) shouldn't block that. It's logged here
      // so an admin can see it needs a manual nudge instead of failing silently.
      await admin.from("timesheet_events").insert({
        timesheet_id: timesheetId,
        event_type: "sent_to_manager",
        actor_type: "system",
        actor_label: facility.manager_email,
        note: `Email send failed: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }
  }

  revalidatePath("/");
  redirect("/");
}
