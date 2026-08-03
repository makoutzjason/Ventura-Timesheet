-- Tables created via the SQL Editor don't automatically get Postgres-level
-- grants for the anon/authenticated database roles the way tables created
-- through Studio's Table Editor UI do. RLS policies only decide WHICH rows
-- a role can touch — they don't grant the privilege to touch the table at
-- all. Without this, every query fails with "permission denied for table
-- ..." (Postgres error 42501) no matter how correct the RLS policy is.

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;

grant select, insert, update, delete on public.facilities to authenticated;

grant select, insert, update, delete on public.travelers to authenticated;

grant select, insert, update on public.timesheets to authenticated;

grant select, insert, update, delete on public.timesheet_entries to authenticated;

grant select, insert, update, delete on public.timesheet_photos to authenticated;

-- Deliberately select-only: rows here are only ever written by server code
-- using the service-role key (which bypasses grants and RLS both), matching
-- the "no insert policy for regular users" note in 0001_init.sql.
grant select on public.timesheet_events to authenticated;

grant select on public.reminder_log to authenticated;

-- approval_tokens gets no grant here on purpose — see 0001_init.sql's
-- comment on that table. Only the service role should ever touch it.
