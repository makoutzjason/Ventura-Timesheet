"use client";

import { useActionState, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  calculateRegularHours,
  calculateOnCallHours,
  calculateCallBackHours,
  calculateGuaranteedHoursTotal,
  needsLunchResolution,
  needsGuaranteedHoursReason,
  SHORT_HOURS_REASON_LABELS,
  GUARANTEED_HOURS_REASON_LABELS,
  GUARANTEED_HOURS_QUALIFYING_REASONS,
} from "@/lib/timesheets";
import { parseDateOnly } from "@/lib/dates";
import { PhotoUploadField, type UploadedPhoto } from "@/components/photo-upload-field";
import { saveTimesheetAction } from "./actions";

type DayInfo = { workDate: string; label: string };

type DayEntry = {
  timeIn: string;
  timeOut: string;
  lunchOut: string;
  lunchIn: string;
  noLunch: boolean;
  shortHoursReason: string;
  comments: string;
  onCallTimeIn: string;
  onCallTimeOut: string;
  callBackTimeIn: string;
  callBackTimeOut: string;
  callBackReason: string;
  mileage: string;
};

const inputClass = "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm";
const labelClass = "text-xs text-zinc-600";

export function TimesheetForm({
  days,
  initialEntries,
  initialGuaranteedHoursNote,
  initialGuaranteedHoursReason,
  guaranteedHours,
  weekStartDate,
  weekEndDate,
  timesheetId,
  wasFlagged,
  facilityId,
  skipManagerApproval,
  travelerId,
  initialPhotos,
}: {
  days: DayInfo[];
  initialEntries: DayEntry[];
  initialGuaranteedHoursNote: string;
  initialGuaranteedHoursReason: string;
  guaranteedHours: number | null;
  weekStartDate: string;
  weekEndDate: string;
  timesheetId: string | null;
  wasFlagged: boolean;
  facilityId: string;
  skipManagerApproval: boolean;
  travelerId: string;
  initialPhotos: UploadedPhoto[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [guaranteedHoursNote, setGuaranteedHoursNote] = useState(initialGuaranteedHoursNote);
  const [guaranteedHoursReason, setGuaranteedHoursReason] = useState(initialGuaranteedHoursReason);
  const [photos, setPhotos] = useState(initialPhotos);

  const boundAction = saveTimesheetAction.bind(null, {
    facilityId,
    guaranteedHours,
    weekStartDate,
    weekEndDate,
    workDates: days.map((day) => day.workDate),
    timesheetId,
    wasFlagged,
  });
  const [state, formAction, pending] = useActionState(boundAction, null);
  const [clientError, setClientError] = useState<string | null>(null);

  function updateEntry(index: number, patch: Partial<DayEntry>) {
    setEntries((previous) => previous.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  // Instant feedback before the round trip — the server action re-checks
  // this independently and is the actual authority, so this is purely UX.
  function handleSubmitClick(event: FormEvent<HTMLButtonElement>) {
    const unresolved = days.filter((day, index) => {
      const entry = entries[index];
      return needsLunchResolution(entry.timeIn, entry.timeOut, entry.lunchOut, entry.lunchIn, entry.noLunch);
    });

    if (unresolved.length > 0) {
      event.preventDefault();
      const labels = unresolved.map((day) => format(parseDateOnly(day.workDate), "EEE, MMM d")).join("; ");
      setClientError(`Enter lunch times or check "No lunch" before submitting for: ${labels}.`);
      return;
    }

    if (skipManagerApproval && photos.length === 0) {
      event.preventDefault();
      setClientError("Upload at least one photo of your clock-in/out record before submitting.");
      return;
    }

    if (shortfallNeedsReason && !guaranteedHoursReason) {
      event.preventDefault();
      setClientError("Select a reason for not meeting guaranteed hours before submitting.");
      return;
    }

    setClientError(null);
  }

  const totalRegularHours = entries.reduce((sum, entry) => {
    const hours = calculateRegularHours(entry.timeIn, entry.timeOut, entry.lunchOut, entry.lunchIn, entry.noLunch);
    return sum + (hours ?? 0);
  }, 0);
  const totalOnCallHours = entries.reduce((sum, entry) => {
    return sum + (calculateOnCallHours(entry.onCallTimeIn, entry.onCallTimeOut) ?? 0);
  }, 0);
  const totalCallBackHours = entries.reduce((sum, entry) => {
    return sum + (calculateCallBackHours(entry.callBackTimeIn, entry.callBackTimeOut) ?? 0);
  }, 0);
  const totalMileage = entries.reduce((sum, entry) => sum + (Number(entry.mileage) || 0), 0);
  const guaranteedHoursTotal = calculateGuaranteedHoursTotal(entries);
  const shortfallNeedsReason = needsGuaranteedHoursReason(guaranteedHours, guaranteedHoursTotal);
  const notQualifyingReasons = Object.keys(GUARANTEED_HOURS_REASON_LABELS).filter(
    (value) => !(GUARANTEED_HOURS_QUALIFYING_REASONS as readonly string[]).includes(value),
  );

  return (
    <form action={formAction} className="space-y-5">
      {(clientError || state?.error) && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{clientError ?? state?.error}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Regular Hours</h2>
        {days.map((day, index) => {
          const entry = entries[index];
          const hours = calculateRegularHours(entry.timeIn, entry.timeOut, entry.lunchOut, entry.lunchIn, entry.noLunch);
          const lunchUnresolved = needsLunchResolution(
            entry.timeIn,
            entry.timeOut,
            entry.lunchOut,
            entry.lunchIn,
            entry.noLunch,
          );

          return (
            <div
              key={day.workDate}
              className={`rounded-lg border bg-white p-3 ${lunchUnresolved ? "border-amber-400" : "border-zinc-200"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">{day.label}</span>
                <span className="text-xs text-zinc-500">{hours !== null ? `${hours} hrs` : "Off"}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={labelClass}>
                  Time in
                  <input
                    type="time"
                    name={`days.${index}.timeIn`}
                    value={entry.timeIn}
                    onChange={(event) => updateEntry(index, { timeIn: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Time out
                  <input
                    type="time"
                    name={`days.${index}.timeOut`}
                    value={entry.timeOut}
                    onChange={(event) => updateEntry(index, { timeOut: event.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  id={`no-lunch-${index}`}
                  type="checkbox"
                  name={`days.${index}.noLunch`}
                  value="true"
                  checked={entry.noLunch}
                  onChange={(event) =>
                    updateEntry(index, {
                      noLunch: event.target.checked,
                      lunchOut: event.target.checked ? "" : entry.lunchOut,
                      lunchIn: event.target.checked ? "" : entry.lunchIn,
                    })
                  }
                />
                <label htmlFor={`no-lunch-${index}`} className={labelClass}>
                  No lunch
                </label>
              </div>

              {!entry.noLunch && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    Lunch out
                    <input
                      type="time"
                      name={`days.${index}.lunchOut`}
                      value={entry.lunchOut}
                      onChange={(event) => updateEntry(index, { lunchOut: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Lunch in
                    <input
                      type="time"
                      name={`days.${index}.lunchIn`}
                      value={entry.lunchIn}
                      onChange={(event) => updateEntry(index, { lunchIn: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
              )}
              {entry.noLunch && (
                // Keep the field names present (empty) so the server always
                // sees a value for every day, whether or not lunch fields render.
                <>
                  <input type="hidden" name={`days.${index}.lunchOut`} value="" />
                  <input type="hidden" name={`days.${index}.lunchIn`} value="" />
                </>
              )}
              {lunchUnresolved && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Required: enter lunch times above, or check &quot;No lunch&quot; if you didn&apos;t take one.
                </p>
              )}

              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={labelClass}>
                  Reason for short hours
                  <select
                    name={`days.${index}.shortHoursReason`}
                    value={entry.shortHoursReason}
                    onChange={(event) => updateEntry(index, { shortHoursReason: event.target.value })}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {Object.entries(SHORT_HOURS_REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Comments
                  <input
                    type="text"
                    name={`days.${index}.comments`}
                    value={entry.comments}
                    onChange={(event) => updateEntry(index, { comments: event.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
          <span className="text-sm font-medium text-zinc-900">Total hours for week</span>
          <span className="text-sm text-zinc-900">{Math.round(totalRegularHours * 100) / 100}</span>
        </div>
      </section>

      {guaranteedHours !== null && (
        <div
          className={`rounded-lg border p-3 text-sm ${shortfallNeedsReason ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-white"}`}
        >
          <p className="text-zinc-900">
            Guaranteed hours: <span className="font-medium">{guaranteedHours}</span> · Worked (incl. call-back):{" "}
            <span className="font-medium">{Math.round(guaranteedHoursTotal * 100) / 100}</span>
          </p>
          {shortfallNeedsReason && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Required: select a reason below before submitting.
            </p>
          )}
        </div>
      )}

      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-zinc-900">
          On-Call {totalOnCallHours > 0 && `(${Math.round(totalOnCallHours * 100) / 100} hrs)`}
        </summary>
        <div className="space-y-2 px-3 pb-3">
          {days.map((day, index) => {
            const entry = entries[index];
            const hours = calculateOnCallHours(entry.onCallTimeIn, entry.onCallTimeOut);
            return (
              <div key={day.workDate} className="rounded-md border border-zinc-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-900">{day.label}</span>
                  <span className="text-xs text-zinc-500">{hours !== null ? `${hours} hrs` : ""}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    Time in
                    <input
                      type="time"
                      name={`days.${index}.onCallTimeIn`}
                      value={entry.onCallTimeIn}
                      onChange={(event) => updateEntry(index, { onCallTimeIn: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Time out
                    <input
                      type="time"
                      name={`days.${index}.onCallTimeOut`}
                      value={entry.onCallTimeOut}
                      onChange={(event) => updateEntry(index, { onCallTimeOut: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="font-medium text-zinc-900">Total on-call hours</span>
            <span className="text-zinc-900">{Math.round(totalOnCallHours * 100) / 100}</span>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-zinc-900">
          Call-Back {totalCallBackHours > 0 && `(${Math.round(totalCallBackHours * 100) / 100} hrs)`}
        </summary>
        <p className="px-3 text-xs text-zinc-500">Can only be called back if on-call — otherwise log it as an extra shift above.</p>
        <div className="space-y-2 px-3 pb-3 pt-2">
          {days.map((day, index) => {
            const entry = entries[index];
            const hours = calculateCallBackHours(entry.callBackTimeIn, entry.callBackTimeOut);
            return (
              <div key={day.workDate} className="rounded-md border border-zinc-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-900">{day.label}</span>
                  <span className="text-xs text-zinc-500">{hours !== null ? `${hours} hrs` : ""}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    Time in
                    <input
                      type="time"
                      name={`days.${index}.callBackTimeIn`}
                      value={entry.callBackTimeIn}
                      onChange={(event) => updateEntry(index, { callBackTimeIn: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Time out
                    <input
                      type="time"
                      name={`days.${index}.callBackTimeOut`}
                      value={entry.callBackTimeOut}
                      onChange={(event) => updateEntry(index, { callBackTimeOut: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className={`${labelClass} mt-2 block`}>
                  Reason
                  <input
                    type="text"
                    name={`days.${index}.callBackReason`}
                    value={entry.callBackReason}
                    onChange={(event) => updateEntry(index, { callBackReason: event.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="font-medium text-zinc-900">Total call-back hours</span>
            <span className="text-zinc-900">{Math.round(totalCallBackHours * 100) / 100}</span>
          </div>
        </div>
      </details>

      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-zinc-900">
          Mileage {totalMileage > 0 && `(${totalMileage})`}
        </summary>
        <div className="space-y-2 px-3 pb-3">
          {days.map((day, index) => {
            const entry = entries[index];
            return (
              <div key={day.workDate} className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-900">{day.label}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  name={`days.${index}.mileage`}
                  value={entry.mileage}
                  onChange={(event) => updateEntry(index, { mileage: event.target.value })}
                  className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1 text-sm">
            <span className="font-medium text-zinc-900">Total mileage</span>
            <span className="text-zinc-900">{totalMileage}</span>
          </div>
        </div>
      </details>

      {shortfallNeedsReason ? (
        <fieldset
          className={`space-y-3 rounded-lg border bg-white p-3 ${!guaranteedHoursReason ? "border-amber-400" : "border-zinc-200"}`}
        >
          <legend className="px-1 text-sm font-semibold text-zinc-900">Guaranteed hours not met</legend>

          <div>
            <p className="text-xs font-medium text-zinc-700">Qualifies for guaranteed hours</p>
            {GUARANTEED_HOURS_QUALIFYING_REASONS.map((value) => (
              <label key={value} className="mt-1 flex items-center gap-2 text-sm text-zinc-900">
                <input
                  type="radio"
                  name="guaranteedHoursReason"
                  value={value}
                  checked={guaranteedHoursReason === value}
                  onChange={(event) => setGuaranteedHoursReason(event.target.value)}
                />
                {GUARANTEED_HOURS_REASON_LABELS[value]}
              </label>
            ))}
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-700">Does not qualify for guaranteed hours</p>
            {notQualifyingReasons.map((value) => (
              <label key={value} className="mt-1 flex items-center gap-2 text-sm text-zinc-900">
                <input
                  type="radio"
                  name="guaranteedHoursReason"
                  value={value}
                  checked={guaranteedHoursReason === value}
                  onChange={(event) => setGuaranteedHoursReason(event.target.value)}
                />
                {GUARANTEED_HOURS_REASON_LABELS[value]}
              </label>
            ))}
          </div>

          {!guaranteedHoursReason && (
            <p className="text-xs font-medium text-amber-700">Required before submitting.</p>
          )}

          <label className="block text-sm font-medium text-zinc-700">
            Optional note
            <textarea
              name="guaranteedHoursNote"
              rows={2}
              value={guaranteedHoursNote}
              onChange={(event) => setGuaranteedHoursNote(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </fieldset>
      ) : (
        // Keep both fields present in the payload even when the picker is
        // hidden, so a prior pick/note isn't silently dropped if hours are
        // edited back up above the guarantee before saving.
        <>
          <input type="hidden" name="guaranteedHoursReason" value={guaranteedHoursReason} />
          <input type="hidden" name="guaranteedHoursNote" value={guaranteedHoursNote} />
        </>
      )}

      {skipManagerApproval && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">Photo of clock-in/out record</h2>
          <p className="text-xs text-zinc-600">
            This facility doesn&apos;t use manager email approval — upload a photo/screenshot of your
            clock-in/out record from the hospital&apos;s system instead. Your admin reviews and approves it
            directly.
          </p>
          <PhotoUploadField
            travelerId={travelerId}
            weekStartDate={weekStartDate}
            photos={photos}
            onPhotosChange={setPhotos}
          />
        </section>
      )}

      <div className="flex gap-2 pb-4">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="flex-1 rounded-md border border-zinc-300 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending}
          onClick={handleSubmitClick}
          className="flex-1 rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {wasFlagged ? "Resubmit" : "Submit"}
        </button>
      </div>
    </form>
  );
}
