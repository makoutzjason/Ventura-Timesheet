export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft — not yet submitted",
  awaiting_manager: "Submitted — awaiting manager approval",
  awaiting_photo: "Submitted — photo upload needed",
  flagged: "Flagged by manager — needs correction",
  photo_submitted: "Vendor Timesheet — awaiting review",
  approved: "Approved",
  paid: "Paid",
};

// Only these statuses let a traveler still edit and (re)submit — everything
// else is out of their hands (with a manager, with admin, or already paid).
export function isEditableStatus(status: string) {
  return status === "draft" || status === "flagged";
}

export const SHORT_HOURS_REASON_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  volunteered_to_leave: "Volunteered to Leave",
  sick: "Sick",
  personal: "Personal",
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Shift-based healthcare work is routinely overnight (e.g. 19:00 -> 07:00),
// so "end earlier than start" means it crossed midnight rather than being
// invalid — this adds a day's worth of minutes in that case instead of
// producing a negative number. Shared by regular, on-call, and call-back
// hours, since all three can span midnight the same way.
function diffMinutesOvernightSafe(start: string, end: string) {
  let minutes = timeToMinutes(end) - timeToMinutes(start);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
}

function roundHours(minutes: number) {
  return Math.max(0, Math.round((minutes / 60) * 100) / 100);
}

// The paper form's own rule defaults an undocumented lunch to a 30-minute
// deduction. Product decision: no silent assumptions — a worked day must
// have either real lunch times or an explicit "No lunch" before it can be
// submitted (enforced in the submit action via needsLunchResolution below),
// so by the time hours are actually calculated, "undocumented" shouldn't
// happen. This returns 0 in that case rather than guessing.
export function calculateLunchMinutes(lunchOut: string, lunchIn: string, noLunch: boolean) {
  if (noLunch) return 0;
  if (lunchOut && lunchIn) return diffMinutesOvernightSafe(lunchOut, lunchIn);
  return 0;
}

// A day only needs lunch resolved if it was actually worked (both a time in
// and time out) — a day off has nothing to resolve.
export function needsLunchResolution(
  timeIn: string,
  timeOut: string,
  lunchOut: string,
  lunchIn: string,
  noLunch: boolean,
) {
  const wasWorked = Boolean(timeIn && timeOut);
  const lunchResolved = noLunch || Boolean(lunchOut && lunchIn);
  return wasWorked && !lunchResolved;
}

export function calculateRegularHours(
  timeIn: string,
  timeOut: string,
  lunchOut: string,
  lunchIn: string,
  noLunch: boolean,
): number | null {
  if (!timeIn || !timeOut) return null;
  const workedMinutes = diffMinutesOvernightSafe(timeIn, timeOut);
  const lunchMinutes = calculateLunchMinutes(lunchOut, lunchIn, noLunch);
  return roundHours(workedMinutes - lunchMinutes);
}

// On-call and call-back hours don't have a lunch deduction — they're not a
// regular shift.
export function calculateOnCallHours(timeIn: string, timeOut: string): number | null {
  if (!timeIn || !timeOut) return null;
  return roundHours(diffMinutesOvernightSafe(timeIn, timeOut));
}

export function calculateCallBackHours(timeIn: string, timeOut: string): number | null {
  return calculateOnCallHours(timeIn, timeOut);
}
