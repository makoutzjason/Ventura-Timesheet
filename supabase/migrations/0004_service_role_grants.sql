-- service_role also needs explicit table grants, same reasoning as
-- authenticated in 0003_grants.sql — it bypasses Row Level Security (the
-- BYPASSRLS attribute) but isn't a Postgres superuser, so it still needs
-- the underlying GRANT to touch a table at all. This is what backs
-- src/lib/supabase/admin.ts: the manager approval flow, the audit log
-- (timesheet_events), and any future background jobs.

grant usage on schema public to service_role;

grant all on public.profiles to service_role;
grant all on public.facilities to service_role;
grant all on public.travelers to service_role;
grant all on public.timesheets to service_role;
grant all on public.timesheet_entries to service_role;
grant all on public.timesheet_photos to service_role;
grant all on public.timesheet_events to service_role;
grant all on public.reminder_log to service_role;
grant all on public.approval_tokens to service_role;
