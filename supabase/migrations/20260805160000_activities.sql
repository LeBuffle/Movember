-- =========================================================================
-- DEFI Movember — the internal activity format (story 3.1)
--
-- Architecture D3: the application does not know Strava. It knows ONE
-- internal format, and every source — Strava today, Garmin one day, a set of
-- made-up activities in preproduction — is converted into it at the border.
-- The challenge engine reads this table and nothing else.
--
-- Written now, before the Strava connection, and deliberately. The two risks
-- of epic 3 are external: the athlete quota, and whether the intended use
-- fits Strava's developer terms. Neither can be settled by a technical
-- decision. This layer is what let epic 4 be built in full without Strava,
-- and it is the single place to adjust if Strava ever imposes a constraint.
--
-- =========================================================================
-- WHAT IS DELIBERATELY ABSENT (architecture D9, FR35)
--
--   no GPS track, no start or finish point, no heart rate, no power,
--   no cadence, no detailed altitude.
--
-- These are the most sensitive things Strava exposes — home address and
-- health data — and NO challenge in the PRD needs any of them. A column that
-- does not exist cannot leak, cannot be exported by mistake, and cannot be
-- asked for by a subpoena. Story 3.4 adds an automated test that fails the
-- build if any of them ever appears.
-- =========================================================================

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- Which source it came from, and its identifier THERE. Unique per source,
  -- not globally: Strava's 42 and a simulated 42 are different activities.
  provider text not null check (provider in ('strava', 'manual', 'simulated')),
  provider_activity_id text not null,

  -- What the participant called it. Shown, never used to decide anything.
  name text not null default '',

  -- Already reduced to the catalogue's families (story 4.1). A challenge
  -- author has no business choosing between `Run`, `TrailRun` and
  -- `VirtualRun`, so the distinction dies at the border.
  sport_family text not null check (
    sport_family in ('run', 'bike', 'swim', 'strength', 'walk', 'any')
  ),

  started_at timestamptz not null,

  -- The calendar day it counts for, computed in Europe/Paris at the border.
  --
  -- Stored rather than derived on each read, and this is the classic trap: a
  -- run starting at 23:40 belongs to that day whatever timezone the server
  -- happens to be set to. Deriving it later, on a machine on UTC, is exactly
  -- how a Sunday evening run ends up validating Monday's challenge.
  local_date date not null,

  -- Metres and seconds, converted once, here. Everything downstream works in
  -- these units and never has to ask.
  distance_meters integer not null default 0 check (distance_meters >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  elevation_meters integer not null default 0 check (elevation_meters >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.activities is
  'The single internal activity format (architecture D3). No GPS track, no heart rate, no power, no cadence — see D9.';

comment on column public.activities.local_date is
  'Calendar day in Europe/Paris, computed at the border. Never derived from started_at downstream.';

-- The same activity, twice, is one row.
--
-- Not a precaution: a replayed webhook, an hourly catch-up passing over a
-- period already received, and an initial import overlapping both will all
-- happen — and a check in the code does not hold when two of them cross. The
-- database refuses it, and the callers treat 23505 as success.
create unique index activities_one_per_provider_activity
  on public.activities (provider, provider_activity_id);

-- What the engine reads: one participant's activities, most recent first.
create index activities_profile_day_idx
  on public.activities (profile_id, local_date desc);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.activities enable row level security;

create policy "participants read their own activities"
  on public.activities for select
  to authenticated
  using ((select auth.uid()) = profile_id);

-- Needed to arbitrate: "why was this challenge not validated?" cannot be
-- answered without seeing what came in (story 4.10, and the anti-cheat queue
-- of epic 9).
create policy "admins read every activity"
  on public.activities for select
  to authenticated
  using ((select public.is_admin()));

-- No write policy on `activities`, for anyone — the same rule as
-- `challenge_assignments`, for the same reason.
--
-- Activities are written by the ingestion, server-side, with the service key.
-- A participant able to insert an activity could hand themselves a 40 km run
-- and clear the month; one able to update it could stretch a walk into a
-- marathon. The leaderboard is what is being protected, and a leaderboard
-- nobody trusts kills the game.
