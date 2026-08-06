-- Admin-set guaranteed hours per week for a traveler's current assignment.
-- Null means no guarantee applies (e.g. PRN) — no gate is enforced.
alter table public.travelers add column guaranteed_hours numeric(6, 2);

-- Snapshot of travelers.guaranteed_hours taken at timesheet-creation time,
-- same rationale as timesheets.facility_id: a traveler's guarantee can
-- change later without altering the record of what applied to a past week.
alter table public.timesheets add column guaranteed_hours numeric(6, 2);

-- The paper form's "CHECK ONE" reason box for not meeting guaranteed hours,
-- week-level (unlike timesheet_entries.short_hours_reason, which is per
-- day). The reason itself encodes qualification: low_census is
-- facility-driven (qualifies for guaranteed-hours pay); the other four are
-- traveler-driven (do not qualify).
alter table public.timesheets add column guaranteed_hours_reason text
  check (guaranteed_hours_reason in ('low_census', 'sick', 'facility_closed', 'personal_time_off', 'volunteered_to_leave'));
