import { getResendClient } from "@/lib/email/resend";

export async function sendApprovalRequestEmail({
  to,
  travelerName,
  facilityName,
  weekLabel,
  approveUrl,
}: {
  to: string;
  travelerName: string;
  facilityName: string;
  weekLabel: string;
  approveUrl: string;
}) {
  const client = getResendClient();
  if (!client) {
    // Caller (the submit action) already catches this and logs it as a
    // timesheet_events note instead of failing the traveler's submission.
    throw new Error("RESEND_API_KEY is not configured");
  }

  // Resend's onboarding domain is a workable fallback before you've verified
  // your own sending domain (SETUP.md step 5) — real facility managers won't
  // receive mail from it in practice, only your own Resend account address.
  const from = process.env.EMAIL_FROM || "Ventura Timesheets <onboarding@resend.dev>";

  // Resend's SDK does NOT throw on an API-level rejection (bad key, sandbox
  // restriction, etc.) — it resolves normally with an `error` field set. Every
  // caller of this function relies on try/catch to detect a failed send, so
  // that has to be turned into a real throw here or those failures silently
  // vanish (this is exactly what happened before this check existed: sends
  // were logged as successful with zero indication anything was wrong).
  const { error } = await client.emails.send({
    from,
    to,
    subject: `Timesheet approval needed: ${travelerName} — ${weekLabel}`,
    html: `
      <p>Hi,</p>
      <p><strong>${travelerName}</strong> submitted a timesheet for <strong>${weekLabel}</strong> at ${facilityName} and needs your review.</p>
      <p><a href="${approveUrl}">Review and approve this timesheet</a></p>
      <p style="color:#666;font-size:13px">This link is single-use and expires in 7 days.</p>
    `,
  });
  if (error) throw new Error(error.message);
}
