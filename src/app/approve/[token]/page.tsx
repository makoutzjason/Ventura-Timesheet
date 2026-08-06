import { createAdminClient } from "@/lib/supabase/admin";
import { hashApprovalToken } from "@/lib/tokens";
import { parseDateOnly, formatWeekLabel } from "@/lib/dates";
import { TimesheetSummary } from "@/components/timesheet-summary";
import { ApprovalForm } from "./approval-form";

// No login here on purpose — the token in the URL IS the credential, so
// every lookup below goes through the service-role admin client (bypassing
// RLS entirely) rather than a per-manager session that doesn't exist.
export default async function ApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const tokenHash = hashApprovalToken(token);

  const { data: approvalToken, error: tokenError } = await admin
    .from("approval_tokens")
    .select("id, timesheet_id, expires_at, used_at, action_taken")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) {
    console.error("[approve] token lookup error:", tokenError);
  }

  if (!approvalToken) {
    return <StatusMessage title="Link not found" body="This approval link doesn't match anything on file." />;
  }

  if (approvalToken.used_at) {
    return (
      <StatusMessage
        title="Already reviewed"
        body={`This timesheet was already ${approvalToken.action_taken ?? "actioned"} using this link.`}
      />
    );
  }

  if (new Date(approvalToken.expires_at) < new Date()) {
    return (
      <StatusMessage title="Link expired" body="This approval link has expired. Ask the traveler to resubmit." />
    );
  }

  const { data: timesheet } = await admin
    .from("timesheets")
    .select(
      "id, status, week_start_date, week_end_date, traveler_id, guaranteed_hours, guaranteed_hours_reason, guaranteed_hours_note, facilities(name)",
    )
    .eq("id", approvalToken.timesheet_id)
    .single();

  if (!timesheet || timesheet.status !== "awaiting_manager") {
    return <StatusMessage title="No longer pending" body="This timesheet is no longer awaiting your review." />;
  }

  const { data: entries } = await admin
    .from("timesheet_entries")
    .select(
      "work_date, time_in, time_out, lunch_out, lunch_in, no_lunch, short_hours_reason, notes, on_call_time_in, on_call_time_out, call_back_time_in, call_back_time_out, call_back_reason, mileage",
    )
    .eq("timesheet_id", timesheet.id)
    .order("work_date", { ascending: true });

  const { data: travelerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", timesheet.traveler_id)
    .single();

  const facility = timesheet.facilities as unknown as { name: string } | null;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Review timesheet</h1>
        <p className="text-sm text-zinc-600">
          {travelerProfile?.full_name} — {facility?.name}
        </p>
        <p className="text-sm text-zinc-600">
          {formatWeekLabel(parseDateOnly(timesheet.week_start_date), parseDateOnly(timesheet.week_end_date))}
        </p>
      </div>

      <TimesheetSummary
        entries={entries ?? []}
        guaranteedHours={timesheet.guaranteed_hours}
        guaranteedHoursReason={timesheet.guaranteed_hours_reason}
        guaranteedHoursNote={timesheet.guaranteed_hours_note}
      />

      <ApprovalForm token={token} />
    </div>
  );
}

function StatusMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-2 px-4 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="text-sm text-zinc-600">{body}</p>
    </div>
  );
}
