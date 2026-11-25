-- =========================================================================
-- DEFI Movember — super teams (story 14.1)
--
-- **A federation entering as a federation.** The concrete case is a national
-- association of local branches: today it can only come in as a handful of
-- teams with no link between them, which takes away precisely what motivates
-- it — watching its branches measure themselves against each other.
--
-- A super team sits ABOVE teams and changes nothing below it. Joining by
-- code, the captain's authority, the general ranking: all untouched. That is
-- what makes this whole epic cuttable in one piece if October gets tight.
-- =========================================================================

create table public.super_teams (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  name text not null check (char_length(name) between 2 and 80),

  -- Used in addresses, like a team's. Same rule, same character set.
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),

  description text not null default '' check (char_length(description) <= 1000),

  -- **Nullable, and deliberately so.** A federation is created before the
  -- name of its referent is known; forcing a captain at creation would mean
  -- inventing one, and an invented captain is one nobody remembers to fix.
  --
  -- `set null` rather than `restrict`: a captain who deletes their account
  -- must not be the reason a whole federation cannot be touched.
  captain_id uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.super_teams is
  'A group of teams for one edition (story 14.1). Created by the organisation only — no participant writes here.';

-- Two federations with the same name would make "3ᵉ de la Table Ronde"
-- ambiguous, which is the one sentence this feature exists to make true.
create unique index super_teams_name_unique
  on public.super_teams (edition_id, lower(name));

create unique index super_teams_slug_unique
  on public.super_teams (edition_id, slug);

create index super_teams_captain_idx on public.super_teams (captain_id);

-- -------------------------------------------------------------------------
-- The attachment
--
-- **A column on `teams`, not a join table**, and the choice is the rule
-- itself. A join table would express "a team may belong to several super
-- teams" — exactly what is forbidden, and it would then have to be forbidden
-- again by a unique index nobody would think to read. A nullable column says
-- "one or none" in the only place that can enforce it.
--
-- `on delete set null`: **removing a super team deletes no team.** The link
-- comes undone, the teams carry on with their members, their points and
-- their place in the general ranking. A deletion that takes teams down with
-- it is a deletion nobody dares make, and one nobody dares make is one the
-- organisation asks the developer to run in November.
-- -------------------------------------------------------------------------
alter table public.teams
  add column super_team_id uuid
    references public.super_teams (id) on delete set null;

comment on column public.teams.super_team_id is
  'The federation this team belongs to, or null. One at most — see story 14.1.';

create index teams_super_team_idx on public.teams (super_team_id);

-- -------------------------------------------------------------------------
-- Reading a super team
--
-- Same trap as `teams`, same answer. Row level security filters ROWS, not
-- COLUMNS. `super_teams` has nothing secret in it today — but `teams` did
-- not either until the join code was added to it, and the view is what makes
-- the next added column a decision rather than an accident.
-- -------------------------------------------------------------------------
create view public.public_super_teams as
  select id, edition_id, name, slug, description, created_at
  from public.super_teams;

comment on view public.public_super_teams is
  'The sanctioned way to read a super team. The captain is not exposed here — a pseudonym is read from public_profiles.';

revoke all on public.public_super_teams from anon, authenticated;
grant select on public.public_super_teams to anon, authenticated;

-- `public_teams` gains the attachment, so a team page can name its
-- federation without reading the private table. Appended at the end: a
-- replaced view may add columns, never reorder them.
create or replace view public.public_teams as
  select id, edition_id, name, slug, kind, created_at, super_team_id
  from public.teams;

-- -------------------------------------------------------------------------
-- Access rules
--
-- No write policy, for anybody — not even for the super team's own captain.
--
-- Worth spelling out, because a policy saying `auth.uid() = captain_id`
-- looks exactly right. It is not: it would let a captain write EVERY column
-- of their row, including `captain_id` itself. They would be able to hand
-- their federation to somebody else, which decision S2 reserves to the
-- organisation. Row level security can check "this row is yours"; it cannot
-- check "and only these three columns".
--
-- So the appearance screen of story 14.5 goes through a server action that
-- writes the columns it is allowed to write, and nothing else.
-- -------------------------------------------------------------------------
alter table public.super_teams enable row level security;

create policy "admins read every super team"
  on public.super_teams for select
  to authenticated
  using ((select public.is_admin()));
