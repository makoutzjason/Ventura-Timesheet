// Every time below is evaluated in each facility's own local time (see
// src/lib/dates.ts getLocalWeekdayAndHour) — "Monday 8am" means 8am
// wherever that facility physically is, not 8am server/UTC time. weekday
// matches Date.getDay(): 0=Sunday..6=Saturday.
//
// This is the single source of truth for both the cron
// (src/app/api/cron/reminders/route.ts) and the reminder_log/timesheet_events
// "stage" labels used for dedup + audit — nothing else should hardcode a
// day/hour pair.

export type Track1Slot = {
  stage: string;
  weekday: number;
  hour: number;
};

// Track 1 — a timesheet is submitted and sitting in "awaiting_manager".
// Four escalating nudges to the facility manager, then automation stops for
// good: no auto-approval, ever. Wednesday 7am is deliberately before
// payroll's 9am CST close.
export const TRACK1_SCHEDULE: Track1Slot[] = [
  { stage: "mon_8am", weekday: 1, hour: 8 },
  { stage: "tue_8am", weekday: 2, hour: 8 },
  { stage: "tue_2pm", weekday: 2, hour: 14 },
  { stage: "wed_7am", weekday: 3, hour: 7 },
];

export type Track2Slot = {
  stage: string;
  weekday: number;
  hour: number;
  notifyManager: boolean;
};

// Track 2 — the traveler hasn't submitted anything at all for the current
// week. Before the Sunday submission deadline it's just a friendly nudge to
// the traveler; once it's actually overdue (Monday onward) the manager also
// gets told, so they can personally chase their traveler. Stops after
// Tuesday — same "then a human takes over" philosophy as Track 1.
export const TRACK2_SCHEDULE: Track2Slot[] = [
  { stage: "sat_6pm", weekday: 6, hour: 18, notifyManager: false },
  { stage: "sun_6pm", weekday: 0, hour: 18, notifyManager: false },
  { stage: "mon_8am", weekday: 1, hour: 8, notifyManager: true },
  { stage: "tue_8am", weekday: 2, hour: 8, notifyManager: true },
];
