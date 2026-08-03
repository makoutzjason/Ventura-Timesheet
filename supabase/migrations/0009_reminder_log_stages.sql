-- reminder_log was originally "one reminder per traveler per week" — too
-- coarse for Track 2 of the automated reminder system (four escalating
-- stages: Sat 6pm / Sun 6pm / Mon 8am / Tue 8am, all facility-local). Adding
-- a stage column and widening the uniqueness to (traveler, week, stage) lets
-- the cron log — and check — each stage independently, so it can tell "have
-- we already sent Monday's nudge to this traveler this week" without that
-- being confused with Saturday's.
--
-- Existing rows (if any) predate stages entirely; backfilled to 'legacy' so
-- the NOT NULL + uniqueness constraints below have something valid to land
-- on. There's no meaningful stage to infer for them.
alter table public.reminder_log
  add column stage text not null default 'legacy';

alter table public.reminder_log
  alter column stage drop default;

alter table public.reminder_log
  drop constraint reminder_log_traveler_id_week_start_date_key;

alter table public.reminder_log
  add constraint reminder_log_traveler_week_stage_key
  unique (traveler_id, week_start_date, stage);

comment on column public.reminder_log.stage is
  'Which Track 2 schedule slot this row represents (see '
  'src/lib/reminder-schedule.ts), e.g. "sat_6pm", "mon_8am" — not a '
  'timesheet status. Lets the same traveler/week be reminded at multiple '
  'escalating stages instead of just once.';
