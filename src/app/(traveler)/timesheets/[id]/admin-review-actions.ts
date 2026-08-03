"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFlaggedNoticeEmail } from "@/lib/email/send-flagged-notice";
import { formatWeekLabel, parseDateOnly } from "@/lib/dates";

type ActionState = { error: string } | { success: true; action: "approved" | "flagged" } | null;

// Admin already has a real session (unlike the token-based manager flow),
// so this uses the regular RLS client for the read/checks and only reaches
// for the service-role client where RLS has no policy at all
// (timesheet_events, and the Auth Admin API to look up the traveler's email).
export async function reviewPhotoSubmissionAction(
  timesheetId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const intent = formData.get("intent") === "flag" ? "flag" : "approve";
  const flagReason = String(formData.get("flagReason") ?? "").trim();

  if (intent === "flag" && !flagReason) {
    return { error: "Please describe what needs to be corrected." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authorized." };

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: "Not authorized." };

  const { data: timesheet } = await supabase
    .from("timesheets")
    .select("id, status, traveler_id, week_start_date, week_end_date, facilities(name)")
    .eq("id", timesheetId)
    .single();

  if (!timesheet || timesheet.status !== "photo_submitted") {
    return { error: "This timesheet is no longer awaiting photo review." };
  }

  const now = new Date().toISOString();

  if (intent === "approve") {
    const { error } = await supabase.from("timesheets").update({ status: "approved", approved_at: now }).eq("id", timesheetId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("timesheets")
      .update({ status: "flagged", flag_reason: flagReason })
      .eq("id", timesheetId);
    if (error) return { error: error.message };
  }

  const admin = createAdminClient();
  await admin.from("timesheet_events").insert({
    timesheet_id: timesheetId,
    event_type: intent === "approve" ? "approved" : "flagged",
    actor_type: "admin",
    actor_id: user.id,
    actor_label: profile.full_name ?? null,
    note: intent === "flag" ? flagReason : null,
  });

  if (intent === "flag") {
    const { data: authUser } = await admin.auth.admin.getUserById(timesheet.traveler_id);
    const travelerEmail = authUser?.user?.email;

    if (travelerEmail) {
      const facility = timesheet.facilities as unknown as { name: string } | null;
      const weekLabel = formatWeekLabel(
        parseDateOnly(timesheet.week_start_date),
        parseDateOnly(timesheet.week_end_date),
      );

      try {
        await sendFlaggedNoticeEmail({ to: travelerEmail, facilityName: facility?.name ?? "", weekLabel, flagReason });
      } catch (error) {
        await admin.from("timesheet_events").insert({
          timesheet_id: timesheetId,
          event_type: "flagged",
          actor_type: "system",
          note: `Traveler notification email failed: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }
    }
  }

  revalidatePath(`/timesheets/${timesheetId}`);
  return { success: true, action: intent === "approve" ? "approved" : "flagged" };
}
