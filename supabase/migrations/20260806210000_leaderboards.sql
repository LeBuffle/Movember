-- =========================================================================
-- DEFI Movember — the leaderboards (story 7.3)
--
-- **One materialised view feeds all eight rankings** (architecture D14). A
-- ranking recomputed on every page load, for 800 participants, would be both
-- expensive and unstable; fifteen minutes of lag is irrelevant in a game that
-- lasts a month.
--
-- The eight are computed in a single pass over the same data, which is why
-- adding one more is almost free.
--
-- **Two rules carry the integrity of the whole game, and they live here:**
--
--   1. The general ranking is purely sporting. It reads `challenge_assignments`
--      and nothing else — never `card_grants` (architecture D8, PRD D2).
--   2. The collection ranking counts only cards obtained by playing:
--      `source in ('challenge', 'daily_draw')`. A bought pack must not move
--      anybody by a single place.
--
-- `tests/unit/leaderboards.test.ts` reads this file and fails the build if
-- either rule is broken. That is deliberate: this is the one place in the
-- project where money could touch the game.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Tuning, in a table rather than in the view
--
-- The normalisation of the team ranking will be argued about in November, and
-- an unfair-looking formula is worse than no team ranking at all. So it is a
-- row, changeable in one statement, never a deployment (story 7.5 AC 4).
-- -------------------------------------------------------------------------
create table public.leaderboard_settings (
  id boolean primary key default true check (id),

  -- Team score = total points / (member count ^ exponent).
  --
  -- 0 would rank on the raw total — every large team ahead of every small
  -- one. 1 would rank on the plain average, which lets a team of one very
  -- keen participant beat fifty committed ones. The value between the two is
  -- the whole debate, and 0.5 is where it starts.
  team_exponent numeric not null default 0.5
    check (team_exponent >= 0 and team_exponent <= 1),

  -- Below this, a team is not ranked. A team of one is a personal ranking
  -- wearing a team's name.
  team_min_members integer not null default 2 check (team_min_members >= 1),

  updated_at timestamptz not null default now()
);

comment on table public.leaderboard_settings is
  'One row. The team normalisation, changeable in SQL because it will be argued about in November (story 7.5).';

insert into public.leaderboard_settings (id) values (true);

alter table public.leaderboard_settings enable row level security;

-- Public: the rule is displayed in the interface, so hiding the number would
-- be pointless as well as unhelpful.
create policy "everyone reads the ranking settings"
  on public.leaderboard_settings for select
  to anon, authenticated
  using (true);

create policy "only admins change the ranking settings"
  on public.leaderboard_settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- -------------------------------------------------------------------------
-- leaderboard_entries — one row per participant, every figure and every rank
-- -------------------------------------------------------------------------
create materialized view public.leaderboard_entries as
with participants as (
  -- Only active registrations. Somebody who abandoned mid-payment or was
  -- refunded is not in the game, and a ranking that includes them would be
  -- read as a bug by everyone who counts the rows.
  select r.profile_id, r.edition_id
  from public.registrations r
  where r.status = 'active'
),

challenge_totals as (
  select
    a.profile_id,
    a.edition_id,
    coalesce(sum(a.points_awarded), 0)::bigint as points,
    count(*)::bigint as challenges_succeeded
  from public.challenge_assignments a
  where a.status = 'completed'
  group by a.profile_id, a.edition_id
),

card_totals as (
  select
    g.profile_id,
    g.edition_id,
    -- **Only what was earned by playing.** A card from a bought pack or from
    -- the tier-3 bonus enriches a collection and never a score (D8).
    count(distinct g.card_id)::bigint as cards_earned
  from public.card_grants g
  where g.source in ('challenge', 'daily_draw')
  group by g.profile_id, g.edition_id
),

activity_totals as (
  select
    act.profile_id,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'run'), 0
    )::bigint as run_distance_meters,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'bike'), 0
    )::bigint as bike_distance_meters,
    count(*)::bigint as activity_count,
    coalesce(sum(act.duration_seconds), 0)::bigint as total_duration_seconds
  from public.activities act
  group by act.profile_id
),

base as (
  select
    p.profile_id,
    p.edition_id,
    m.team_id,
    coalesce(c.points, 0) as points,
    coalesce(c.challenges_succeeded, 0) as challenges_succeeded,
    coalesce(k.cards_earned, 0) as cards_earned,
    coalesce(t.run_distance_meters, 0) as run_distance_meters,
    coalesce(t.bike_distance_meters, 0) as bike_distance_meters,
    coalesce(t.activity_count, 0) as activity_count,
    coalesce(t.total_duration_seconds, 0) as total_duration_seconds
  from participants p
  left join challenge_totals c
    on c.profile_id = p.profile_id and c.edition_id = p.edition_id
  left join card_totals k
    on k.profile_id = p.profile_id and k.edition_id = p.edition_id
  left join activity_totals t
    on t.profile_id = p.profile_id
  left join public.team_members m
    on m.profile_id = p.profile_id and m.edition_id = p.edition_id
)

select
  profile_id,
  edition_id,
  team_id,
  points,
  challenges_succeeded,
  cards_earned,
  run_distance_meters,
  bike_distance_meters,
  activity_count,
  total_duration_seconds,

  -- `rank`, not `row_number`: two participants on the same score share a
  -- place. Breaking a tie arbitrarily would make the ranking look unstable
  -- every time it is recomputed.
  rank() over (partition by edition_id order by points desc) as rank_points,
  rank() over (
    partition by edition_id order by challenges_succeeded desc
  ) as rank_challenges,
  rank() over (partition by edition_id order by cards_earned desc) as rank_cards,
  rank() over (
    partition by edition_id order by run_distance_meters desc
  ) as rank_run,
  rank() over (
    partition by edition_id order by bike_distance_meters desc
  ) as rank_bike,
  rank() over (
    partition by edition_id order by activity_count desc
  ) as rank_activities,
  rank() over (
    partition by edition_id order by total_duration_seconds desc
  ) as rank_duration,

  now() as computed_at
from base;

comment on materialized view public.leaderboard_entries is
  'All eight rankings, one pass. The general ranking never reads card_grants; the collection ranking counts only challenge and daily_draw (architecture D8, D14).';

-- Required for `refresh materialized view concurrently`, which is what keeps
-- the rankings readable *while* they are being recomputed (story 7.3 AC 5).
-- Without a unique index Postgres refuses, and the refresh takes an exclusive
-- lock instead — a blank ranking for everybody, several times an hour.
create unique index leaderboard_entries_profile
  on public.leaderboard_entries (profile_id, edition_id);

create index leaderboard_entries_points_idx
  on public.leaderboard_entries (edition_id, rank_points);

create index leaderboard_entries_team_idx
  on public.leaderboard_entries (edition_id, team_id);

-- Readable by everybody, including visitors: rankings are public, and they
-- carry no name — only an identifier, which the `public_profiles` view turns
-- into a pseudonym.
revoke all on public.leaderboard_entries from anon, authenticated;
grant select on public.leaderboard_entries to anon, authenticated;

-- -------------------------------------------------------------------------
-- Refreshing
--
-- A function rather than a statement in the application, for two reasons: the
-- application has no way to run `refresh materialized view`, and the
-- concurrency guard belongs next to the thing it guards.
-- -------------------------------------------------------------------------
create function public.refresh_leaderboards()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- **Never waits for a second refresh.** The scheduled task runs every
  -- fifteen minutes; if one run is still going, the next must give up rather
  -- than queue behind it — two hourly tasks piling up is how a small delay
  -- becomes an outage.
  --
  -- The lock is advisory and released at the end of the transaction, so a
  -- process killed mid-refresh does not leave it held.
  if not pg_try_advisory_xact_lock(hashtext('leaderboards')) then
    return false;
  end if;

  refresh materialized view concurrently public.leaderboard_entries;

  return true;
end;
$$;

comment on function public.refresh_leaderboards() is
  'Recomputes the rankings. Returns false when another refresh is already running (story 7.3 AC 7).';

revoke execute on function public.refresh_leaderboards() from public, anon, authenticated;
