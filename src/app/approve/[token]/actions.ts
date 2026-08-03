"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApprovalToken } from "@/lib/tokens";
import { sendFlaggedNoticeEmail } from "@/lib/email/send-flagged-notice";
import { formatWeekLabel, parseDateOnly } from "@/lib/dates";

type ActionState = { error: string } | { success: true; action: "approved" | "flagged" } | null;

// Bound with the token (from the client component) rather than trusting a
// hidden form field — the token in the URL is the only credential here, so
// it has to come from the same server-rendered context that already
// verified it, not from anything the browser could tamper with.
export async function actOnApprovalTokenAction(
  token: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const intent = formData.get("intent") === "flag" ? "flag" : "approve";
  const flagReason = String(formData.get("flagReason") ?? "").trim();
  const managerName = String(formData.get("managerName") ?? "").trim();

  if (!managerName) {
    return { error: "Please enter your name." };
  }
  if (intent === "flag" && !flagReason) {
    return { error: "Please describe what needs to be corrected." };
  }

  const admin = createAdminClient();
  const tokenHash = hashApprovalToken(token);

  // Re-verify from scratch rather than trusting that the page's earlier GET
  // was still accurate — someone could have double-clicked, or another tab
  // could have already used this same link.
  const { data: approvalToken } = await admin
    .from("approval_tokens")
    .select("id, timesheet_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!approvalToken) return { error: "This link is invalid." };
  if (approvalToken.used_at) return { error: "This link has already been used." };
  if (new Date(approvalToken.expires_at) < new Date()) return { error: "This link has expired." };

  const { data: timesheet } = await admin
    .from("timesheets")
    .select("id, status, traveler_id, week_start_date, week_end_date, facilities(name)")
    .eq("id", approvalToken.timesheet_id)
    .single();

  if (!timesheet || timesheet.status !== "awaiting_manager") {
    return { error: "This timesheet is no longer awaiting your review." };
  }

  const now = new Date().toISOString();

  if (intent === "approve") {
    await admin.from("timesheets").update({ status: "approved", approved_at: now }).eq("id", timesheet.id);
    await admin
      .from("approval_tokens")
      .update({ used_at: now, action_taken: "approved" })
      .eq("id", approvalToken.id);
    await admin.from("timesheet_events").insert({
      timesheet_id: timesheet.id,
      event_type: "approved",
      actor_type: "manager",
      actor_label: managerName,
    });
  } else {
    await admin.from("timesheets").update({ status: "flagged", flag_reason: flagReason }).eq("id", timesheet.id);
    await admin
      .from("approval_tokens")
      .update({ used_at: now, action_taken: "flagged" })
      .eq("id", approvalToken.id);
    await admin.from("timesheet_events").insert({
      timesheet_id: timesheet.id,
      event_type: "flagged",
      actor_type: "manager",
      actor_label: managerName,
      note: flagReason,
    });

    // Best-effort, same pattern as the submit action: a failed notification
    // email shouldn't undo the flag itself, just get logged for follow-up.
    const { data: authUser } = await admin.auth.admin.getUserById(timesheet.traveler_id);
    const travelerEmail = authUser?.user?.email;

    if (travelerEmail) {
      const facility = timesheet.facilities as unknown as { name: string } | null;
      const weekLabel = formatWeekLabel(
        parseDateOnly(timesheet.week_start_date),
        parseDateOnly(timesheet.week_end_date),
      );

      try {
        await sendFlaggedNoticeEmail({
          to: travelerEmail,
          facilityName: facility?.name ?? "",
          weekLabel,
          flagReason,
        });
      } catch (error) {
        await admin.from("timesheet_events").insert({
          timesheet_id: timesheet.id,
          event_type: "flagged",
          actor_type: "system",
          note: `Traveler notification email failed: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }
    }
  }

  revalidatePath(`/approve/${token}`);
  return { success: true, action: intent === "approve" ? "approved" : "flagged" };
}
