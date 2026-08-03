-- Only one admin tier exists today, but nothing else in the schema assumes
-- exactly two roles — is_admin() and every RLS policy just check
-- role = 'admin' as a string. Dropping this enum constraint means adding a
-- future tier (e.g. a read-only admin) is purely additive later: a new role
-- value, maybe a new is_x() helper — no migration touching this table.
alter table public.profiles drop constraint profiles_role_check;
