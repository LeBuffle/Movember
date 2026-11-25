-- =========================================================================
-- DEFI Movember — what actually completed a challenge (story 4.3)
--
-- A challenge marked "réussi" with nothing to show for it is a challenge
-- nobody can contest and nobody can explain. The participant who writes in
-- to say their run did not count deserves an answer more precise than "the
-- system says so", and the organiser answering them deserves not to have to
-- reconstruct it from Strava.
-- =========================================================================

alter table public.challenge_assignments
  add column if not exists evidence jsonb not null default '{}'::jsonb;

comment on column public.challenge_assignments.evidence is
  'What satisfied the challenge: {activity_ids: [], measured: number}. Written by the evaluation, never by a participant.';

-- No new access rule, and that is deliberate: `challenge_assignments` still
-- has no write policy for anyone (story 4.1). Evidence is written by the
-- evaluation, server-side, with the service key — a participant able to write
-- their own evidence would be a participant able to award themselves the
-- month.
