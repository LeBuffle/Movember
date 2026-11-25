-- =========================================================================
-- DEFI Movember — team and super team logos (stories 14.4 and 14.5)
--
-- A team wearing its club's badge recognises itself in the application; a
-- line of text does not. Same need one level up for a federation.
--
-- **One bucket for both**, and one set of rules. Two buckets would be two
-- sets of policies drifting apart, for pictures handled identically — the
-- same reasoning that put card visuals and news pictures together.
-- =========================================================================

alter table public.teams
  add column logo_url text,
  add column logo_uploaded_by uuid references public.profiles (id) on delete set null,
  add column logo_uploaded_at timestamptz,
  add column logo_reviewed_at timestamptz;

alter table public.super_teams
  add column logo_url text,
  add column logo_uploaded_by uuid references public.profiles (id) on delete set null,
  add column logo_uploaded_at timestamptz,
  add column logo_reviewed_at timestamptz;

comment on column public.teams.logo_uploaded_by is
  'Who put this picture here. Moderation is a posteriori (epic 14, S3), so the trace is what makes removal possible without an investigation.';

-- **What makes the moderation screen finishable** (story 14.6). A list of
-- every logo with no "already seen" marker is a list you re-read in full
-- every day, and therefore stop reading on the third. Cleared whenever the
-- picture changes, because a reviewed team is not a reviewed picture.
comment on column public.teams.logo_reviewed_at is
  'When the organisation last looked at this logo. Null means it is waiting in the moderation queue.';

-- The moderation screen of story 14.6 reads the most recent uploads first.
create index teams_logo_uploaded_idx
  on public.teams (logo_uploaded_at desc)
  where logo_url is not null;

create index super_teams_logo_uploaded_idx
  on public.super_teams (logo_uploaded_at desc)
  where logo_url is not null;

-- The views gain the logo, so a team page and a ranking can show it without
-- reading the private table. Appended at the end: a replaced view may add
-- columns, never reorder them.
create or replace view public.public_teams as
  select id, edition_id, name, slug, kind, created_at, super_team_id, logo_url
  from public.teams;

create or replace view public.public_super_teams as
  select id, edition_id, name, slug, description, created_at, logo_url
  from public.super_teams;

-- -------------------------------------------------------------------------
-- The bucket
--
-- **Public, like `cartes`.** A team's badge is shown on a public ranking
-- page; signing a URL for each of eighty thumbnails would cost a round trip
-- per row to protect something that is on screen anyway.
--
-- **Two megabytes, not eight.** A card visual is an illustration at printable
-- resolution; a logo is a badge shown forty pixels wide, forty times on one
-- ranking page. What is uploaded is paid for by every participant who opens
-- that screen, every time.
--
-- ⚠️ The bucket limit and `MAX_LOGO_BYTES` in `src/lib/super-teams/logo.ts`
-- must stay identical, and a test compares them. A bucket more permissive
-- than the application gives an application refusal where the file would
-- have passed; the reverse gives an incomprehensible storage error after a
-- long upload.
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152, -- 2 MiB. A badge, not a poster.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------------------
-- Who may write a logo — and why there is no policy at all
--
-- **No insert, update or delete policy on this bucket, for anybody.** That is
-- not an omission; it is the same wall that stands in front of `team_members`.
--
-- Row level security can check "this row is yours". It cannot check "you are
-- the captain of the team this picture is going to be attached to" — the
-- picture is uploaded before anything links it to a team, so at the moment
-- the policy would run there is nothing to check against. A policy loose
-- enough to be writable — "any authenticated participant may upload to
-- `logos`" — would let anybody fill the bucket with anything, and the
-- moderation screen of story 14.6 would be a full-time job.
--
-- So uploads go through the service key, from a server action that has
-- already established captaincy from the session. The limits above still
-- hold: `file_size_limit` and `allowed_mime_types` are enforced by the
-- storage API itself, for every key including that one.
--
-- Dropped first because these names are shared with the rest of the project,
-- and because this migration may well be run twice by hand.
-- -------------------------------------------------------------------------
drop policy if exists "captains upload logos" on storage.objects;
drop policy if exists "captains replace logos" on storage.objects;
drop policy if exists "captains remove logos" on storage.objects;

-- No read policy either: a public bucket is served without one. Adding a
-- select policy here would suggest the bucket is private, which it is not.
