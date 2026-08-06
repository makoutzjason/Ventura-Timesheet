-- profiles gets its own copy of the user's email, kept in sync with
-- auth.users. Needed so the admin travelers list can search/sort by email
-- through the regular RLS-scoped client — auth.users itself is only
-- reachable via the service-role admin client, which isn't something a
-- page render should need just to support a search box.
alter table public.profiles add column email text;

-- Backfilled directly from auth.users in this same migration — both tables
-- live in the same Postgres database, just different schemas — rather than
-- via an external script or the admin API.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

-- Safe to require now that every existing row has been backfilled. Every
-- profiles row has a matching auth.users row (profiles.id references
-- auth.users(id)), and this app only ever creates users via email/password
-- (handle_new_user below, and the invite flow in
-- src/app/admin/travelers/actions.ts) — there's no path that creates a
-- profile without an email.
alter table public.profiles alter column email set not null;

-- Mirrors the uniqueness auth.users.email already has, so this column can
-- never silently drift into a value that doesn't match the real one.
alter table public.profiles add constraint profiles_email_key unique (email);

comment on column public.profiles.email is
  'Mirror of auth.users.email, kept in sync by handle_new_user (on signup) '
  'and sync_profile_email (on email change). Exists so admin pages can '
  'search/sort by email through the regular RLS-scoped client without '
  'reaching into auth.users, which only the service-role client can read.';

-- handle_new_user already runs on every new signup (see 0001_init.sql) —
-- this just adds email to the row it inserts. create or replace means the
-- existing on_auth_user_created trigger doesn't need to change at all,
-- only this function's body.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email);
  return new;
end;
$$;

-- New: keeps profiles.email in sync if someone's auth email ever changes
-- after signup (Supabase's own email-change flow updates auth.users.email
-- directly) — without this, profiles.email would silently go stale the
-- first time that happens. Same pattern as handle_new_user: a trigger on
-- auth.users, security definer, so it runs regardless of who's signed in.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
