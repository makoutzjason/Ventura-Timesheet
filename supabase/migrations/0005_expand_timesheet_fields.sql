-- Expands timesheet_entries to match every field on the actual paper form
-- (Sun-Sat Timesheet), not just regular hours. This replaces the earlier
-- single break_minutes number with what the paper form actually asks for:
-- two lunch clock-times (or an explicit "no lunch" checkbox), a short-hours
-- reason, and separate On-Call / Call-Back / Mileage sections tracked per
-- day. Test data created before this migration will lose its break_minutes
-- values — there's no real production data yet, so that's fine.

alter table public.timesheet_entries drop column break_minutes;

-- Lunch-Out / Lunch-In are clock times, not a duration — the paper form's
-- own rule ("undocumented lunch breaks deducted @ 1/2 hour per day unless
-- noted no lunch") is implemented in src/lib/timesheets.ts, not the DB.
alter table public.timesheet_entries add column lunch_out time;
alter table public.timesheet_entries add column lunch_in time;
alter table public.timesheet_entries add column no_lunch boolean not null default false;

-- The paper form's "CHECK ONE" reason box for a short/irregular day.
alter table public.timesheet_entries add column short_hours_reason text
  check (short_hours_reason in ('cancelled', 'volunteered_to_leave', 'sick', 'personal'));

-- On-call and call-back are separate tables on the paper form, but still
-- fundamentally "this day, this timesheet" data — kept on the same row
-- rather than split into their own tables, so one query gets a full day.
alter table public.timesheet_entries add column on_call_time_in time;
alter table public.timesheet_entries add column on_call_time_out time;
alter table public.timesheet_entries add column call_back_time_in time;
alter table public.timesheet_entries add column call_back_time_out time;
alter table public.timesheet_entries add column call_back_reason text;
alter table public.timesheet_entries add column mileage numeric(6, 1);

-- Weekly-level free text: "EXPLAIN IF GUARANTEED HOURS ARE NOT MET" on the paper form.
alter table public.timesheets add column guaranteed_hours_note text;

-- "RECRUITER NAME" on the paper form's header block — a staffing-company
-- contact for the traveler, distinct from the facility manager.
alter table public.travelers add column recruiter_name text;
