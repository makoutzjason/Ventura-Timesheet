import { format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Turns a Date into a plain "YYYY-MM-DD" string using its local
// year/month/day — this is what gets stored in date columns
// (week_start_date, work_date), so it must never shift across a timezone.
export function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// The inverse of formatDateOnly. Deliberately not `new Date(value)` — that
// parses "YYYY-MM-DD" as UTC midnight, which shifts to the wrong calendar
// day once you read it back with local getters in a timezone behind UTC.
export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Given a facility's week_start_day (0=Sunday..6=Saturday) and IANA time
// zone, returns the 7-day pay week that "now" falls in for that facility:
// its start, its end, and each day in between.
//
// "Now" must be evaluated in the facility's local time, not the server's
// (UTC in production) — a traveler's week boundary is about where they're
// physically working, not where the app happens to run. toZonedTime shifts
// the reference instant so plain local getters (getFullYear/getMonth/
// getDate/getDay, used throughout this file) read as the wall-clock date in
// that zone, regardless of the server's own timezone.
export function getCurrentWeekRange(weekStartDay: number, timeZone: string, referenceDate: Date = new Date()) {
  const today = dateOnly(toZonedTime(referenceDate, timeZone));
  const daysSinceWeekStart = (today.getDay() - weekStartDay + 7) % 7;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysSinceWeekStart);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });

  return { weekStart, weekEnd, days };
}

// Local weekday (0=Sunday..6=Saturday, matching Date.getDay()) and hour
// (0-23) for a facility right now — what the reminder cron matches against
// its schedule tables to decide "is one of this facility's reminder slots
// due this hour."
export function getLocalWeekdayAndHour(timeZone: string, referenceDate: Date = new Date()) {
  const zoned = toZonedTime(referenceDate, timeZone);
  return { weekday: zoned.getDay(), hour: zoned.getHours() };
}

// The real UTC instant corresponding to the start of the *current* local
// hour in the given time zone — e.g. if it's 8:17am in America/Denver right
// now, this returns the UTC instant for 8:00:00am America/Denver today.
// Used as the lower bound when checking "has a reminder already gone out
// for this hour's slot" — the cron runs hourly, so a retry or overlapping
// invocation within the same local hour shouldn't send a duplicate.
export function startOfLocalHour(timeZone: string, referenceDate: Date = new Date()) {
  const zoned = toZonedTime(referenceDate, timeZone);
  const truncatedLocal = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), zoned.getHours(), 0, 0, 0);
  return fromZonedTime(truncatedLocal, timeZone);
}

export function formatWeekLabel(weekStart: Date, weekEnd: Date) {
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const start = format(weekStart, sameMonth ? "MMM d" : "MMM d, yyyy");
  const end = format(weekEnd, "MMM d, yyyy");
  return `${start} – ${end}`;
}
