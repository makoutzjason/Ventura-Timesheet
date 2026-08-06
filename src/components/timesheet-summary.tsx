import {
  calculateRegularHours,
  calculateOnCallHours,
  calculateCallBackHours,
  SHORT_HOURS_REASON_LABELS,
  GUARANTEED_HOURS_REASON_LABELS,
} from "@/lib/timesheets";

export type TimesheetEntryRow = {
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  no_lunch: boolean;
  short_hours_reason: string | null;
  notes: string | null;
  on_call_time_in: string | null;
  on_call_time_out: string | null;
  call_back_time_in: string | null;
  call_back_time_out: string | null;
  call_back_reason: string | null;
  mileage: number | null;
};

function trim(value: string | null) {
  return value?.slice(0, 5) ?? "";
}

// Read-only rendering of a full week's data, shared by the traveler's own
// detail view and the manager's approval page — they need to show the exact
// same thing, so this is the one place that logic lives.
export function TimesheetSummary({
  entries,
  guaranteedHours,
  guaranteedHoursReason,
  guaranteedHoursNote,
}: {
  entries: TimesheetEntryRow[];
  guaranteedHours: number | null;
  guaranteedHoursReason: string | null;
  guaranteedHoursNote: string | null;
}) {
  const totalRegularHours = entries.reduce(
    (sum, e) =>
      sum + (calculateRegularHours(trim(e.time_in), trim(e.time_out), trim(e.lunch_out), trim(e.lunch_in), e.no_lunch) ?? 0),
    0,
  );
  const totalOnCallHours = entries.reduce(
    (sum, e) => sum + (calculateOnCallHours(trim(e.on_call_time_in), trim(e.on_call_time_out)) ?? 0),
    0,
  );
  const totalCallBackHours = entries.reduce(
    (sum, e) => sum + (calculateCallBackHours(trim(e.call_back_time_in), trim(e.call_back_time_out)) ?? 0),
    0,
  );
  const totalMileage = entries.reduce((sum, e) => sum + (e.mileage ?? 0), 0);

  const onCallEntries = entries.filter((e) => e.on_call_time_in || e.on_call_time_out);
  const callBackEntries = entries.filter((e) => e.call_back_time_in || e.call_back_time_out);
  const mileageEntries = entries.filter((e) => e.mileage);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900">Regular Hours</h2>
        {entries.map((entry) => {
          const hours = calculateRegularHours(
            trim(entry.time_in),
            trim(entry.time_out),
            trim(entry.lunch_out),
            trim(entry.lunch_in),
            entry.no_lunch,
          );
          return (
            <div key={entry.work_date} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">{entry.work_date}</span>
                <span className="text-xs text-zinc-500">{hours !== null ? `${hours} hrs` : "Off"}</span>
              </div>
              {entry.time_in && entry.time_out && (
                <p className="mt-1 text-xs text-zinc-600">
                  {trim(entry.time_in)} – {trim(entry.time_out)}
                  {entry.no_lunch
                    ? ", no lunch"
                    : entry.lunch_out && entry.lunch_in
                      ? `, lunch ${trim(entry.lunch_out)}–${trim(entry.lunch_in)}`
                      : ", lunch not noted"}
                </p>
              )}
              {entry.short_hours_reason && (
                <p className="mt-1 text-xs text-amber-700">
                  {SHORT_HOURS_REASON_LABELS[entry.short_hours_reason] ?? entry.short_hours_reason}
                </p>
              )}
              {entry.notes && <p className="mt-1 text-xs text-zinc-600">{entry.notes}</p>}
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
          <span className="text-sm font-medium text-zinc-900">Total hours for week</span>
          <span className="text-sm text-zinc-900">{Math.round(totalRegularHours * 100) / 100}</span>
        </div>
      </section>

      {onCallEntries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">On-Call</h2>
          {onCallEntries.map((entry) => (
            <div key={entry.work_date} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-900">{entry.work_date}</span>
                <span className="text-xs text-zinc-500">
                  {trim(entry.on_call_time_in)} – {trim(entry.on_call_time_out)} (
                  {calculateOnCallHours(trim(entry.on_call_time_in), trim(entry.on_call_time_out))} hrs)
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900">Total on-call hours</span>
            <span className="text-zinc-900">{Math.round(totalOnCallHours * 100) / 100}</span>
          </div>
        </section>
      )}

      {callBackEntries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">Call-Back</h2>
          {callBackEntries.map((entry) => (
            <div key={entry.work_date} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-900">{entry.work_date}</span>
                <span className="text-xs text-zinc-500">
                  {trim(entry.call_back_time_in)} – {trim(entry.call_back_time_out)} (
                  {calculateCallBackHours(trim(entry.call_back_time_in), trim(entry.call_back_time_out))} hrs)
                </span>
              </div>
              {entry.call_back_reason && <p className="mt-1 text-xs text-zinc-600">{entry.call_back_reason}</p>}
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900">Total call-back hours</span>
            <span className="text-zinc-900">{Math.round(totalCallBackHours * 100) / 100}</span>
          </div>
        </section>
      )}

      {mileageEntries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">Mileage</h2>
          {mileageEntries.map((entry) => (
            <div
              key={entry.work_date}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3"
            >
              <span className="text-sm text-zinc-900">{entry.work_date}</span>
              <span className="text-sm text-zinc-900">{entry.mileage}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900">Total mileage</span>
            <span className="text-zinc-900">{totalMileage}</span>
          </div>
        </section>
      )}

      {(guaranteedHours !== null || guaranteedHoursNote) && (
        <section className="rounded-lg border border-zinc-200 bg-white p-3">
          <h2 className="text-sm font-semibold text-zinc-900">Guaranteed hours</h2>
          {guaranteedHours !== null && (
            <p className="mt-1 text-sm text-zinc-600">
              Guaranteed: {guaranteedHours} · Worked (incl. call-back):{" "}
              {Math.round((totalRegularHours + totalCallBackHours) * 100) / 100}
              {guaranteedHoursReason && (
                <> · Reason: {GUARANTEED_HOURS_REASON_LABELS[guaranteedHoursReason] ?? guaranteedHoursReason}</>
              )}
            </p>
          )}
          {guaranteedHoursNote && <p className="mt-1 text-sm text-zinc-600">{guaranteedHoursNote}</p>}
        </section>
      )}
    </div>
  );
}
