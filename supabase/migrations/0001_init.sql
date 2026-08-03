-- ============================================================================
-- Ventura Timesheets — initial schema
-- ============================================================================
-- How to read this file: it's organized in the order things get created —
-- tables, then helper functions/triggers, then Row Level Security (RLS)
-- policies, then storage. RLS is what actually enforces "a traveler can only
-- see their own timesheets" etc. at the database level, so even a bug in
-- application code can't leak another traveler's data.
--
-- Three different people touch this data, with three different access
-- models:
--   - Travelers  -> real Supabase Auth accounts, scoped by RLS to their own rows.
--   - Admins     -> real Supabase Auth accounts, RLS lets them see everything.
--   - Managers   -> NO account at all. They act through a one-time emailed
--                   link, verified by a server-side route using the
--                   service-role key (which bypasses RLS entirely). That's
--                   why approval_tokens has no traveler/admin-facing RLS
--                   policy below — nothing but the service role should ever
--                   touch it.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles: one row per Supabase Auth user (traveler or admin).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'traveler' check (role in ('traveler', 'admin')),
  full_name  text not null,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Extends auth.users with a role. A row is created automatically for every '
  'new auth user (see handle_new_user below), defaulting to traveler — '
  'promote someone to admin by updating this row directly in the SQL editor.';

-- ----------------------------------------------------------------------------
-- facilities: the healthcare facilities travelers are placed at.
-- ----------------------------------------------------------------------------
create table public.facilities (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  address                text,
  manager_name           text,
  manager_email          text not null,
  -- The photo-upload bypass toggle from the admin panel. When true,
  -- submitting a timesheet skips emailing the manager entirely and asks the
  -- traveler to photograph the signed paper timesheet instead.
  skip_manager_approval  boolean not null default false,
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- travelers: staffing-specific fields for a traveler, 1:1 with profiles.
-- ----------------------------------------------------------------------------
create table public.travelers (
  id           uuid primary key references public.profiles (id) on delete cascade,
  -- Current assignment. If a traveler is ever placed at more than one
  -- facility over time, this is a natural spot to split out an
  -- "assignment history" table later — not needed for the MVP.
  facility_id  uuid references public.facilities (id),
  employee_id  text,
  discipline   text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- timesheets: one row per traveler per week.
-- ----------------------------------------------------------------------------
create table public.timesheets (
  id               uuid primary key default gen_random_uuid(),
  traveler_id      uuid not null references public.travelers (id),
  -- Snapshot of the traveler's facility at submission time, so a later
  -- reassignment doesn't rewrite history for already-submitted weeks.
  facility_id      uuid not null references public.facilities (id),
  week_start_date  date not null,
  week_end_date    date not null,
  status           text not null default 'draft' check (
    status in (
      'draft',            -- traveler is filling it out, not yet submitted
      'awaiting_manager',  -- emailed to the facility manager, link not yet used
      'awaiting_photo',     -- bypass facility: waiting on traveler's photo upload
      'flagged',            -- manager flagged it; traveler needs to correct + resubmit
      'photo_submitted',      -- bypass facility: photo uploaded, awaiting admin review
      'approved',              -- manager approved, or admin approved a bypass photo
      'paid'                    -- payroll has processed it
    )
  ),
  flag_reason      text,
  submitted_at     timestamptz,
  approved_at      timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- One timesheet per traveler per week — resubmitting after a flag reuses
  -- this same row (status flips back to awaiting_manager) rather than
  -- creating a new one, so there's always exactly one current record per week.
  unique (traveler_id, week_start_date)
);

create index timesheets_status_idx on public.timesheets (status);

-- ----------------------------------------------------------------------------
-- timesheet_entries: one row per day within a timesheet.
-- ----------------------------------------------------------------------------
create table public.timesheet_entries (
  id             uuid primary key default gen_random_uuid(),
  timesheet_id   uuid not null references public.timesheets (id) on delete cascade,
  work_date      date not null,
  time_in        time,
  time_out       time,
  break_minutes  integer not null default 0,
  hours_worked   numeric(4, 2),
  notes          text,
  unique (timesheet_id, work_date)
);

-- ----------------------------------------------------------------------------
-- timesheet_photos: bypass-path evidence (photo of the signed paper form).
-- ----------------------------------------------------------------------------
create table public.timesheet_photos (
  id            uuid primary key default gen_random_uuid(),
  timesheet_id  uuid not null references public.timesheets (id) on delete cascade,
  -- Path within the private "timesheet-photos" storage bucket, not a public URL.
  storage_path  text not null,
  uploaded_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- approval_tokens: the one-time links emailed to facility managers.
-- ----------------------------------------------------------------------------
create table public.approval_tokens (
  id            uuid primary key default gen_random_uuid(),
  timesheet_id  uuid not null references public.timesheets (id) on delete cascade,
  -- SHA-256 hash of the token that appears in the email link. The raw token
  -- is never stored — see src/lib/tokens.ts.
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  action_taken  text check (action_taken in ('approved', 'flagged')),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- timesheet_events: append-only audit trail. Healthcare staffing payroll
-- tends to get disputed/audited, so every state change is recorded here
-- rather than only keeping the latest status on the timesheet row.
-- ----------------------------------------------------------------------------
create table public.timesheet_events (
  id            uuid primary key default gen_random_uuid(),
  timesheet_id  uuid not null references public.timesheets (id) on delete cascade,
  event_type    text not null check (
    event_type in (
      'submitted', 'sent_to_manager', 'approved', 'flagged',
      'resubmitted', 'photo_uploaded', 'photo_reviewed', 'marked_paid'
    )
  ),
  -- Who did it. actor_id is null for 'manager' (they have no user id) and
  -- for 'system' (automated) — actor_label carries a human-readable name/email instead.
  actor_type    text not null check (actor_type in ('traveler', 'manager', 'admin', 'system')),
  actor_id      uuid references public.profiles (id),
  actor_label   text,
  note          text,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- reminder_log: prevents sending a traveler more than one reminder per week.
-- ----------------------------------------------------------------------------
create table public.reminder_log (
  id               uuid primary key default gen_random_uuid(),
  traveler_id      uuid not null references public.travelers (id),
  week_start_date  date not null,
  sent_at          timestamptz not null default now(),
  unique (traveler_id, week_start_date)
);

-- ============================================================================
-- Helper functions + triggers
-- ============================================================================

-- Keeps updated_at current on every row update, on every table that has one.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.facilities
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.travelers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.timesheets
  for each row execute function public.set_updated_at();

-- Creates a profiles row automatically whenever someone is added to Supabase
-- Auth (e.g. when an admin invites a traveler by email). Defaults to the
-- 'traveler' role; promote to 'admin' by hand in the SQL editor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used throughout the RLS policies below instead of repeating the same
-- subquery in every policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.facilities enable row level security;
alter table public.travelers enable row level security;
alter table public.timesheets enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.timesheet_photos enable row level security;
alter table public.timesheet_events enable row level security;
alter table public.reminder_log enable row level security;
-- approval_tokens gets RLS turned on with NO policies below, which means
-- deny-all for every regular client — only the service-role key (which
-- ignores RLS by design) can read or write it. That's intentional: the
-- manager-approval route is the only thing that should ever touch this table.
alter table public.approval_tokens enable row level security;

-- profiles: you can see/update your own row; admins can see/update everyone's.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.is_admin());

-- facilities: any signed-in traveler can read (they need to see their own
-- facility's info); only admins can create/edit/deactivate.
create policy "facilities_select_authenticated" on public.facilities
  for select using (auth.role() = 'authenticated');
create policy "facilities_admin_write" on public.facilities
  for all using (public.is_admin()) with check (public.is_admin());

-- travelers: you can see your own record; admins manage everyone's.
create policy "travelers_select_own_or_admin" on public.travelers
  for select using (id = auth.uid() or public.is_admin());
create policy "travelers_admin_write" on public.travelers
  for all using (public.is_admin()) with check (public.is_admin());

-- timesheets: a traveler can see and create/edit their own; admins see and
-- manage all of them. Managers never touch this table directly — they only
-- ever go through the token-verified API route.
create policy "timesheets_select_own_or_admin" on public.timesheets
  for select using (traveler_id = auth.uid() or public.is_admin());
create policy "timesheets_insert_own" on public.timesheets
  for insert with check (traveler_id = auth.uid());
create policy "timesheets_update_own_or_admin" on public.timesheets
  for update using (traveler_id = auth.uid() or public.is_admin());

-- timesheet_entries: scoped through the parent timesheet's owner.
create policy "timesheet_entries_own_or_admin" on public.timesheet_entries
  for all using (
    public.is_admin() or exists (
      select 1 from public.timesheets t
      where t.id = timesheet_entries.timesheet_id and t.traveler_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.timesheets t
      where t.id = timesheet_entries.timesheet_id and t.traveler_id = auth.uid()
    )
  );

-- timesheet_photos: same pattern — scoped through the parent timesheet.
create policy "timesheet_photos_own_or_admin" on public.timesheet_photos
  for all using (
    public.is_admin() or exists (
      select 1 from public.timesheets t
      where t.id = timesheet_photos.timesheet_id and t.traveler_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.timesheets t
      where t.id = timesheet_photos.timesheet_id and t.traveler_id = auth.uid()
    )
  );

-- timesheet_events: read-only for travelers (their own history); admins see all.
-- Rows are only ever inserted by server-side code using the service-role
-- client, so there's no insert policy for regular users here.
create policy "timesheet_events_select_own_or_admin" on public.timesheet_events
  for select using (
    public.is_admin() or exists (
      select 1 from public.timesheets t
      where t.id = timesheet_events.timesheet_id and t.traveler_id = auth.uid()
    )
  );

-- reminder_log: admin-only visibility. Written by the cron job via the
-- service-role client.
create policy "reminder_log_admin_select" on public.reminder_log
  for select using (public.is_admin());

-- ============================================================================
-- Storage: private bucket for bypass-path timesheet photos
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('timesheet-photos', 'timesheet-photos', false)
on conflict (id) do nothing;

-- Photos are uploaded under a path like "{traveler_id}/{timesheet_id}/xyz.jpg",
-- so storage.foldername(name)[1] gives us the traveler_id to check against.
create policy "timesheet_photos_upload_own" on storage.objects
  for insert with check (
    bucket_id = 'timesheet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "timesheet_photos_read_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'timesheet-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
