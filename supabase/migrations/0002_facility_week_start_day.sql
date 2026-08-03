-- Pay weeks vary by facility (Sun-Sat, Thu-Wed, Sat-Fri, etc.), so this has
-- to live on the facility, not be a single app-wide rule.
--
-- Stored as 0=Sunday..6=Saturday, matching JavaScript's Date.getDay(), so
-- src/lib/dates.ts can use it directly without translating day names.
alter table public.facilities
  add column week_start_day smallint not null default 0
  check (week_start_day between 0 and 6);

comment on column public.facilities.week_start_day is
  'Day the facility''s pay week starts: 0=Sunday, 1=Monday, ... 6=Saturday. '
  'Used to compute each traveler''s current week_start_date/week_end_date.';
