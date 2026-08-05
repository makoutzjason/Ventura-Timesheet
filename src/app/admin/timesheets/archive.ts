import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";

// Admin-archive-only display convention: every historical week is labeled
// and filed under "Week Ending [Saturday date]," always, regardless of a
// facility's actual week_start_day. This is deliberately NOT in
// src/lib/dates.ts alongside getCurrentWeekRange — that file is the real
// per-facility week logic (traveler submission, reminders) and must never
// pick up this convention. This exists purely so the admin archive has one
// consistent label across every facility, mixed week-start-days and all.
//
// Well-defined for any week_start_day: a 7-day span always contains exactly
// one Saturday, so this never has to guess or approximate — it's always the
// Saturday that actually falls within that specific timesheet's own week.
export function adminWeekEndingDate(weekStartDate: string): Date {
  const start = parseDateOnly(weekStartDate);
  const daysUntilSaturday = (6 - start.getDay() + 7) % 7;
  const saturday = new Date(start);
  saturday.setDate(start.getDate() + daysUntilSaturday);
  return saturday;
}

export type ArchiveRow = {
  key: string;
  travelerName: string;
  travelerHref: string;
  facilityName: string;
  weekLabel: string;
  statusLabel: string;
};

export type ArchiveWeek = { weekKey: string; label: string; rows: ArchiveRow[] };
export type ArchiveMonth = { monthKey: string; label: string; weeks: ArchiveWeek[] };
export type ArchiveYear = { year: number; months: ArchiveMonth[] };

// Groups rows that aren't in the current week into year -> month -> "Week
// Ending" buckets, all keyed off adminWeekEndingDate rather than the row's
// raw week_start_date/week_end_date, and sorted most-recent-first at every
// level. Object keys aren't used for the year/month grouping (only the leaf
// week map) because JS reorders integer-like object keys ascending
// regardless of insertion order — years and month numbers would silently
// end up oldest-first.
export function buildArchiveTree(rows: (ArchiveRow & { weekStartDate: string })[]): ArchiveYear[] {
  const byYear = new Map<number, Map<number, Map<string, ArchiveWeek>>>();

  for (const row of rows) {
    const saturday = adminWeekEndingDate(row.weekStartDate);
    const year = saturday.getFullYear();
    const month = saturday.getMonth();
    const weekKey = format(saturday, "yyyy-MM-dd");

    if (!byYear.has(year)) byYear.set(year, new Map());
    const byMonth = byYear.get(year)!;

    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const byWeek = byMonth.get(month)!;

    if (!byWeek.has(weekKey)) {
      byWeek.set(weekKey, { weekKey, label: `Week Ending ${format(saturday, "M/d/yyyy")}`, rows: [] });
    }
    byWeek.get(weekKey)!.rows.push(row);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, byMonth]) => ({
      year,
      months: [...byMonth.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, byWeek]) => ({
          monthKey: `${year}-${month}`,
          label: format(new Date(year, month, 1), "MMMM"),
          weeks: [...byWeek.values()].sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1)),
        })),
    }));
}
