-- =========================================================================
-- DEFI Movember — how an activity was recorded (story 3.4)
--
-- One boolean, and the reason it exists now rather than with the story that
-- uses it.
--
-- The PO has already decided that activities **typed in by hand** on Strava
-- are excluded from evaluation, while imports from a watch stay accepted —
-- the normal case for a Garmin or Polar owner (PRD point P11, architecture
-- A5). The exclusion itself belongs to story 9.8.
--
-- But a flag not captured at the border cannot be recovered afterwards
-- without asking Strava again for every activity of every participant. So it
-- is recorded from the first import, and nothing reads it yet. That is the
-- one case where writing a column before its use is the cheap option rather
-- than the speculative one.
-- =========================================================================

alter table public.activities
  add column if not exists is_manual boolean not null default false;

comment on column public.activities.is_manual is
  'Typed in by hand at the provider rather than recorded by a device. Nothing filters on it yet — story 9.8 does.';

-- Still nothing sensitive, and that is the point of this story: no track, no
-- start or finish point, no heart rate, no power, no cadence, no detailed
-- altitude. `tests/unit/activity-minimisation.test.ts` reads every migration
-- in this folder and fails the build if any of them ever appears.
