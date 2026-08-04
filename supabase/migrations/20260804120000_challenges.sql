-- =========================================================================
-- DEFI Movember — challenge catalogue and daily assignments (story 4.1)
--
-- The structural decision of the project (architecture D2, NFR18): a
-- challenge is a ROW, never code. The application supplies seven
-- evaluators; a challenge is a card that picks one and hands it parameters.
--
-- What that buys: creating "5 km de course aujourd'hui" is filling a form in
-- October, not deploying in November. The organisation builds the catalogue
-- ahead of time and the month runs itself.
-- =========================================================================

-- -------------------------------------------------------------------------
-- challenges — the catalogue
--
-- A row here is a challenge AVAILABLE, not a challenge dated. Nobody writes
-- "the challenge of 12 November": the daily task draws from this pool
-- (architecture D13).
-- -------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',

  -- Names one of the seven evaluators the application provides. Constrained
  -- here as well as in the code: a value the application cannot evaluate
  -- must not be storable in the first place.
  evaluator text not null check (
    evaluator in (
      'distance', 'duration', 'elevation',
      'streak', 'multisport', 'collective', 'surprise'
    )
  ),

  -- The evaluator's parameters. Validated by `src/lib/challenges/config.ts`
  -- on the way in AND on the way out — a row can be edited straight in SQL,
  -- and a configuration written months ago may predate a schema change.
  config jsonb not null default '{}'::jsonb,

  sport_family text not null default 'any' check (
    sport_family in ('run', 'bike', 'swim', 'strength', 'walk', 'any')
  ),
  difficulty text not null default 'moyen'
    check (difficulty in ('facile', 'moyen', 'difficile')),

  -- What the challenge is worth in the general leaderboard (architecture
  -- D14). Counting challenges rather than points would favour whoever drew
  -- the easiest ones — and the challenges differ from one participant to the
  -- next, so it would be visibly unfair.
  --
  -- Bounded because an unbounded points column is one typo away from making
  -- a single challenge worth the whole month.
  points integer not null default 10 check (points between 1 and 1000),

  duration_scope text not null default 'day'
    check (duration_scope in ('day', 'multi_day')),
  duration_days integer check (duration_days between 1 and 30),

  -- How many cards a success is worth, and how they are drawn (epic 5).
  reward_rules jsonb not null default '{"cards": 1, "draw": "random_weighted"}'::jsonb,

  -- Withdrawn from the draw without being deleted. Deleting would take the
  -- past assignments and results that reference it.
  is_active boolean not null default true,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A multi-day challenge without a number of days cannot be judged.
  constraint challenges_multi_day_has_days check (
    duration_scope = 'day' or duration_days is not null
  )
);

comment on table public.challenges is
  'Challenge catalogue. A row is an available challenge, not a dated one.';

comment on column public.challenges.config is
  'Evaluator parameters. Validated by the application on read as well as on write.';

create index challenges_edition_active_idx
  on public.challenges (edition_id, is_active, sport_family);

-- -------------------------------------------------------------------------
-- challenge_assignments — who got what, and when
-- -------------------------------------------------------------------------
create table public.challenge_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete restrict,

  assigned_for date not null,

  -- `draw` is the daily individual assignment, `common` a challenge imposed
  -- on everyone for a day (story 4.8), `manual` a catch-up by an
  -- administrator. The distinction matters because the "never twice the same
  -- challenge" rule applies to draws only.
  source text not null default 'draw'
    check (source in ('draw', 'common', 'manual')),

  -- A missed challenge stays `open`: it does not block the next one, and a
  -- later activity can still complete it (PRD D3).
  status text not null default 'open'
    check (status in ('open', 'completed', 'missed')),

  completed_at timestamptz,

  -- Its own copy of the points, taken at completion. The catalogue's value
  -- can be corrected mid-edition; what was already earned must not move.
  -- Same reasoning as the payments table (architecture D12).
  points_awarded integer check (points_awarded >= 0),

  created_at timestamptz not null default now(),

  constraint challenge_assignments_completed_has_points check (
    status <> 'completed'
    or (completed_at is not null and points_awarded is not null)
  )
);

comment on table public.challenge_assignments is
  'One challenge assigned to one participant for one day. Written server-side only.';

-- Never the same challenge twice — for drawn assignments (story 4.1 AC 10).
-- A common challenge is shared by design and may recur from one animation to
-- the next, so it is excluded (story 4.8 AC 3).
create unique index challenge_assignments_no_repeat
  on public.challenge_assignments (profile_id, challenge_id)
  where source = 'draw';

-- One drawn challenge per person per day. This is what makes the daily task
-- replayable: a cron that fails halfway will be run again — by the system,
-- or by someone worried at six in the morning — and without this the second
-- run hands a second challenge to everyone who already had one.
create unique index challenge_assignments_one_draw_per_day
  on public.challenge_assignments (profile_id, assigned_for)
  where source = 'draw';

create index challenge_assignments_open_idx
  on public.challenge_assignments (profile_id, status, assigned_for desc);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.challenges enable row level security;
alter table public.challenge_assignments enable row level security;

-- The catalogue is a spoiler. A participant who could read all of it would
-- know what is coming for the rest of the month — which is not dangerous,
-- but removes the point of a daily surprise. They see a challenge only once
-- it has been assigned to them.
create policy "participants read only their assigned challenges"
  on public.challenges for select
  to authenticated
  using (
    exists (
      select 1
      from public.challenge_assignments a
      where a.challenge_id = challenges.id
        and a.profile_id = (select auth.uid())
    )
  );

create policy "admins read the whole catalogue"
  on public.challenges for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write the catalogue"
  on public.challenges for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "participants read their own assignments"
  on public.challenge_assignments for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every assignment"
  on public.challenge_assignments for select
  to authenticated
  using ((select public.is_admin()));

-- No write policy on `challenge_assignments`, for anyone.
--
-- Assignments are created by the scheduled task and completed by the
-- evaluation, both server-side with the service key. A participant able to
-- insert an assignment could hand themselves an easy challenge; one able to
-- update it could mark it completed. The leaderboard is what is being
-- protected here, and a leaderboard nobody trusts kills the game.
-- Administrators arbitrate through story 4.10, which goes through the
-- server and leaves a trace.
