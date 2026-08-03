import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { TimesheetPdf, type TimesheetPdfData } from "@/lib/pdf/timesheet-pdf";

// Uses the regular RLS-scoped client, not the service-role admin client —
// so a traveler can only ever generate their own PDF, and an admin can
// generate any, exactly matching the access rules already enforced on
// /timesheets/[id]. No separate authorization logic needed here.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ timesheetId: string }> },
) {
  const { timesheetId } = await params;
  const supabase = await createClient();

  const { data: timesheet } = await supabase
    .from("timesheets")
    .select(
      "id, status, week_start_date, week_end_date, guaranteed_hours_note, submitted_at, traveler_id, facilities(name)",
    )
    .eq("id", timesheetId)
    .maybeSingle();

  if (!timesheet) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // The PDF is payroll's artifact for a fully approved week — generating one
  // from an in-progress timesheet would just be a preview of incomplete data.
  if (timesheet.status !== "approved" && timesheet.status !== "paid") {
    return NextResponse.json({ error: "This timesheet hasn't been approved yet." }, { status: 409 });
  }

  const { data: entryRows } = await supabase
    .from("timesheet_entries")
    .select(
      "work_date, time_in, time_out, lunch_out, lunch_in, no_lunch, short_hours_reason, notes, on_call_time_in, on_call_time_out, call_back_time_in, call_back_time_out, call_back_reason, mileage",
    )
    .eq("timesheet_id", timesheetId)
    .order("work_date", { ascending: true });

  const { data: travelerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", timesheet.traveler_id)
    .single();

  const { data: travelerRow } = await supabase
    .from("travelers")
    .select("recruiter_name")
    .eq("id", timesheet.traveler_id)
    .single();

  // The manager never has an account, so their "signature" is whatever name
  // they typed into the approval form, recovered here from the audit log —
  // it's the only place that name is stored.
  const { data: approvalEvent } = await supabase
    .from("timesheet_events")
    .select("actor_label, created_at")
    .eq("timesheet_id", timesheetId)
    .eq("event_type", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const facility = timesheet.facilities as unknown as { name: string } | null;

  const data: TimesheetPdfData = {
    travelerName: travelerProfile?.full_name ?? "",
    facilityName: facility?.name ?? "",
    recruiterName: travelerRow?.recruiter_name ?? null,
    weekStartDate: timesheet.week_start_date,
    weekEndDate: timesheet.week_end_date,
    guaranteedHoursNote: timesheet.guaranteed_hours_note,
    entries: (entryRows ?? []).map((row) => ({
      workDate: row.work_date,
      timeIn: row.time_in?.slice(0, 5) ?? null,
      timeOut: row.time_out?.slice(0, 5) ?? null,
      lunchOut: row.lunch_out?.slice(0, 5) ?? null,
      lunchIn: row.lunch_in?.slice(0, 5) ?? null,
      noLunch: row.no_lunch,
      shortHoursReason: row.short_hours_reason,
      comments: row.notes,
      onCallTimeIn: row.on_call_time_in?.slice(0, 5) ?? null,
      onCallTimeOut: row.on_call_time_out?.slice(0, 5) ?? null,
      callBackTimeIn: row.call_back_time_in?.slice(0, 5) ?? null,
      callBackTimeOut: row.call_back_time_out?.slice(0, 5) ?? null,
      callBackReason: row.call_back_reason,
      mileage: row.mileage,
    })),
    employeeSignature: timesheet.submitted_at
      ? { name: travelerProfile?.full_name ?? "", timestamp: timesheet.submitted_at }
      : null,
    facilitySignature: approvalEvent
      ? { name: approvalEvent.actor_label ?? "", timestamp: approvalEvent.created_at }
      : null,
  };

  // renderToBuffer's type expects a Document element specifically; the
  // wrapper component satisfies that at runtime (it renders a <Document>),
  // TypeScript just can't see through the extra layer.
  const element = createElement(TimesheetPdf, { data }) as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="timesheet-${timesheet.week_start_date}.pdf"`,
    },
  });
}
