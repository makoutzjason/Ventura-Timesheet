import { getResendClient } from "@/lib/email/resend";

// Track 2 (traveler hasn't submitted at all) — see src/lib/reminder-schedule.ts.
// Sent to the facility manager once it's actually overdue (not on the first,
// pre-deadline nudge to the traveler), so they can personally follow up.
// No link — the manager has no account and nothing to approve yet, there's
// simply nothing submitted.
export async function sendTravelerMissingNoticeEmail({
  to,
  travelerName,
  facilityName,
  weekLabel,
}: {
  to: string;
  travelerName: string;
  facilityName: string;
  weekLabel: string;
}) {
  const client = getResendClient();
  if (!client) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = process.env.EMAIL_FROM || "Ventura Timesheets <onboarding@resend.dev>";

  // See the comment in send-approval-request.ts — Resend's SDK resolves
  // normally with an `error` field on an API-level rejection instead of
  // throwing, so this has to be turned into a real throw for callers'
  // try/catch to actually detect a failed send.
  const { error } = await client.emails.send({
    from,
    to,
    subject: `${travelerName} hasn't submitted a timesheet yet — ${weekLabel}`,
    html: `
      <p>Hi,</p>
      <p><strong>${travelerName}</strong> hasn't submitted a timesheet for <strong>${weekLabel}</strong> at ${facilityName} yet. They've been reminded — a nudge from you may help too.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
