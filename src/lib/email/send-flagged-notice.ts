import { getResendClient } from "@/lib/email/resend";

export async function sendFlaggedNoticeEmail({
  to,
  facilityName,
  weekLabel,
  flagReason,
}: {
  to: string;
  facilityName: string;
  weekLabel: string;
  flagReason: string;
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
    subject: `Timesheet needs a correction — ${weekLabel}`,
    html: `
      <p>Hi,</p>
      <p>Your timesheet for <strong>${weekLabel}</strong> at ${facilityName} was flagged by your facility manager:</p>
      <blockquote style="margin:0;padding:8px 12px;background:#fff8e1;border-left:3px solid #f5c518;">${flagReason}</blockquote>
      <p><a href="${appUrl}/timesheets/new">Sign in to correct it</a>, then resubmit.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
