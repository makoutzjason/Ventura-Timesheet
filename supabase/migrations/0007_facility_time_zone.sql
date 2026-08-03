-- Reminder timing, "current week," daily cutoffs, and any other "what
-- day/time is it for this traveler" calculation has to run in the
-- *facility's* local time — a traveler's shift, their local midnight, their
-- local end-of-day are all anchored to where they physically work, not
-- their home address and not the server's clock. IANA zone names (not raw
-- UTC offsets) so this stays correct across DST changes automatically.
--
-- No CHECK constraint against a fixed list of zone names on purpose —
-- Postgres has no built-in IANA timezone catalog to validate against, and
-- hardcoding one here would drift out of sync over time. The app validates
-- against Intl.supportedValuesOf('timeZone') instead (see
-- src/app/admin/facilities/actions.ts), which stays current with the
-- runtime's own tzdata and covers any US zone (or any zone at all) without
-- us maintaining a list.
--
-- Existing rows don't need a manual backfill: a NOT NULL default on a new
-- column is applied to every existing row as part of this same migration.
alter table public.facilities
  add column time_zone text not null default 'America/Denver';

comment on column public.facilities.time_zone is
  'IANA time zone name (e.g. "America/Denver") for the facility''s physical '
  'location. Determines the traveler''s local time for week boundaries, '
  'daily cutoffs, and reminder timing — not the traveler''s home address.';
