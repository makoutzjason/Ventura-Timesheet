-- Adds "manager_reminder_sent" as a valid timesheet_events.event_type, for
-- the admin dashboard's manual "send reminder" action (and, later, the
-- automated reminder cron) to log when a nudge went out to a facility
-- manager. CHECK constraints can't be altered in place, so this drops and
-- recreates it with the new value added.
--
-- If timesheet_events_event_type_check isn't the actual constraint name in
-- your database (Postgres' default naming can drift), find it with:
--   select conname from pg_constraint where conrelid = 'public.timesheet_events'::regclass;
alter table public.timesheet_events
  drop constraint timesheet_events_event_type_check;

alter table public.timesheet_events
  add constraint timesheet_events_event_type_check
  check (event_type in (
    'submitted', 'sent_to_manager', 'approved', 'flagged',
    'resubmitted', 'photo_uploaded', 'photo_reviewed', 'marked_paid',
    'manager_reminder_sent'
  ));
