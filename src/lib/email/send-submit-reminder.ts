import { getResendClient } from "@/lib/email/resend";

// Track 2 (traveler hasn't submitted at all) — see src/lib/reminder-schedule.ts.
export async function sendSubmitReminderEmail({
  to,
  facilityName,
  weekLabel,
}: {
  to: string;
  facilityName: string;
  weekLabel: string;
}) {
  const client = getResendClient();
  if (!client) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = process.env.EMAIL_FROM || "Ventura Timesheets <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // See the comment in send-approval-request.ts — Resend's SDK resolves
  // normally with an `error` field on an API-level rejection instead of
  // throwing, so this has to be turned into a real throw for callers'
  // try/catch to actually detect a failed send.
  const { error } = await client.emails.send({
    from,
    to,
    subject: `Reminder: submit your timesheet — ${weekLabel}`,
    html: `
      <p>Hi,</p>
      <p>We don't have a timesheet from you yet for <strong>${weekLabel}</strong> at ${facilityName}.</p>
      <p><a href="${appUrl}/timesheets/new">Sign in to submit it</a>.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
