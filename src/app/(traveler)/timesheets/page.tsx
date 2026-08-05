import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly, formatWeekLabel } from "@/lib/dates";
import { STATUS_LABELS, isEditableStatus } from "@/lib/timesheets";

export default async function TimesheetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: timesheets, error: timesheetsError } = await supabase
    .from("timesheets")
    .select("id, week_start_date, week_end_date, status")
    .eq("traveler_id", user.id)
    .order("week_start_date", { ascending: false });

  if (timesheetsError) {
    console.error("[timesheets] query error:", timesheetsError);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Your timesheets</h1>

      {!timesheets?.length && <p className="text-sm text-zinc-600">Nothing submitted yet.</p>}

      <div className="space-y-2">
        {timesheets?.map((timesheet) => (
          <Link
            key={timesheet.id}
            href={
              isEditableStatus(timesheet.status)
                ? `/timesheets/new?timesheetId=${timesheet.id}`
                : `/timesheets/${timesheet.id}`
            }
            className="block rounded-lg border border-zinc-200 bg-white p-3"
          >
            <p className="text-sm font-medium text-zinc-900">
              {formatWeekLabel(parseDateOnly(timesheet.week_start_date), parseDateOnly(timesheet.week_end_date))}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{STATUS_LABELS[timesheet.status] ?? timesheet.status}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
