-- =========================================================================
-- DEFI Movember — the challenge everybody gets (story 4.8)
--
-- The mechanism for the shared moments (architecture D13): the same challenge
-- for everyone on 11 November, a collective goal on the last weekend. Without
-- it the game has no common ground at all — four hundred people advancing
-- alone, each with their own challenges.
-- =========================================================================

create table public.common_challenges (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  -- `restrict`: a challenge that has been scheduled for everyone cannot be
  -- deleted out from under the day it was scheduled for.
  challenge_id uuid not null references public.challenges (id) on delete restrict,

  scheduled_for date not null,

  -- **An explicit choice, never a default the code picked.** Both readings
  -- make sense — a common challenge that replaces lightens the day, one that
  -- adds loads it — and letting the code decide would produce the wrong
  -- surprise one day in two.
  mode text not null check (mode in ('replace', 'additional')),

  -- Cancelled rather than deleted, so that "there was a common challenge that
  -- day and it was called off" stays a fact one can read.
  cancelled_at timestamptz,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- One common challenge per day. Two would stop being "common".
  constraint common_challenges_one_per_day unique (edition_id, scheduled_for)
);

comment on table public.common_challenges is
  'The challenge imposed on everyone for a given day. One per day, cancellable while the day is ahead.';

create index common_challenges_edition_date_idx
  on public.common_challenges (edition_id, scheduled_for);

-- -------------------------------------------------------------------------
-- One common assignment per person per day
--
-- `source = 'common'` sits outside the individual index on purpose: a common
-- challenge coexists with the day's own draw when the mode is `additional`.
-- But it needs an index of its own, or a replayed daily task would hand the
-- same person the same common challenge twice.
-- -------------------------------------------------------------------------
create unique index challenge_assignments_one_common_per_day
  on public.challenge_assignments (profile_id, assigned_for)
  where source = 'common';

-- The "never the same challenge twice" rule still does not apply here
-- (story 4.1): a common challenge is shared by design, and an animation may
-- reuse one from a previous day.

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.common_challenges enable row level security;

-- Participants never read this table. They meet the common challenge through
-- their own assignment, like any other — reading the schedule would tell them
-- what is coming, and a shared surprise announced in advance is not one.
create policy "admins read the common challenges"
  on public.common_challenges for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins schedule a common challenge"
  on public.common_challenges for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
