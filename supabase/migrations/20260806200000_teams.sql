-- =========================================================================
-- DEFI Movember — teams (story 7.1)
--
-- **The main growth lever identified for this edition**: a team is what lets
-- a club or a company come in as one block rather than one person at a time.
-- =========================================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  name text not null check (char_length(name) between 2 and 60),

  -- Used in addresses, so it must survive an accent and a space.
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),

  -- **The secret.** Whoever holds it can join, so it is never exposed to
  -- anybody but the captain — see the access rules and the view below.
  join_code text not null,

  captain_id uuid not null references public.profiles (id) on delete restrict,

  kind text not null default 'libre'
    check (kind in ('libre', 'entreprise', 'association')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teams is
  'A team for one edition. The join code is a secret: read it only through the captain policy (story 7.1).';

-- Two teams with the same name in the same edition would make every ranking
-- ambiguous — and the ranking is the whole point of a team.
create unique index teams_name_unique
  on public.teams (edition_id, lower(name));

create unique index teams_slug_unique on public.teams (edition_id, slug);

-- Codes are compared, never listed. A collision would silently send somebody
-- into the wrong team, so the database refuses it rather than the generator
-- promising it will not happen.
create unique index teams_join_code_unique on public.teams (join_code);

-- -------------------------------------------------------------------------
-- team_members
--
-- `edition_id` is carried here as well as on the team, and it is not
-- redundant: it is what makes "one team per participant per edition"
-- expressible as a unique index rather than as a check the application
-- remembers to run.
-- -------------------------------------------------------------------------
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,

  role text not null default 'membre' check (role in ('capitaine', 'membre')),
  joined_at timestamptz not null default now()
);

comment on table public.team_members is
  'One participant, one team, one edition. The unique index is what makes the team ranking mean anything.';

-- The rule the whole team ranking rests on.
--
-- Without it, somebody could sit in three teams and count three times — and
-- the ranking would be arithmetic nonsense that nobody could explain.
create unique index team_members_one_team_per_edition
  on public.team_members (profile_id, edition_id);

create index team_members_by_team_idx on public.team_members (team_id);

-- -------------------------------------------------------------------------
-- public_teams — the sanctioned way to read a team
--
-- Same trap as `public_profiles`, and the same answer. Row level security
-- filters ROWS, not COLUMNS: letting participants read the `teams` table so
-- they can see team names would hand them every join code at the same time,
-- and joining would stop being the captain's decision.
--
-- So the table stays private and this view is the only way in.
-- -------------------------------------------------------------------------
create view public.public_teams as
  select id, edition_id, name, slug, kind, created_at
  from public.teams;

comment on view public.public_teams is
  'Name, slug and kind. Never the join code — that is the whole reason this view exists.';

revoke all on public.public_teams from anon, authenticated;
grant select on public.public_teams to anon, authenticated;

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- The captain reads their own team's row — which is how they get the join
-- code to share. Nobody else reads this table.
create policy "captains read their own team"
  on public.teams for select
  to authenticated
  using ((select auth.uid()) = captain_id);

create policy "admins read every team"
  on public.teams for select
  to authenticated
  using ((select public.is_admin()));

-- Memberships are readable: a team page lists who is in it, and the ranking
-- needs to know who counts. There is nothing personal here — a profile
-- identifier, a role, a date — and the pseudonym comes from `public_profiles`.
create policy "participants read memberships"
  on public.team_members for select
  to authenticated
  using (true);

-- No write policy on either table, for anybody.
--
-- This one is worth spelling out, because a participant writing their own
-- membership row looks harmless. It is not: row level security can check
-- "this row is yours", it cannot check "you knew the join code". A policy
-- allowing `auth.uid() = profile_id` would therefore let anybody walk into
-- any team by identifier alone — the captain's control would be decorative,
-- and the team ranking would be open to whoever wanted to sit in the leading
-- team.
--
-- Creating, joining, leaving and excluding all go through server actions
-- that verify what the database cannot.
