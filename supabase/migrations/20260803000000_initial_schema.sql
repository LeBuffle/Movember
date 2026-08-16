-- =========================================================================
-- DEFI Movember — initial schema
--
-- Two tables only: `editions` and `profiles`. Game tables arrive with their
-- own epics, each carrying its own row level security policies. Security is
-- never a later story.
--
-- RULE FOR EVERY FUTURE MIGRATION: any table added under `public` must
-- enable row level security in the same migration that creates it.
-- `tests/unit/rls.test.ts` reads these files and fails the build otherwise.
-- =========================================================================

-- -------------------------------------------------------------------------
-- editions
--
-- An edition is data, not a version of the software (architecture, decision
-- D11): the 2027 edition should launch by inserting rows, not by
-- redeveloping. Every piece of game content will reference this table.
-- -------------------------------------------------------------------------
create table public.editions (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  registration_opens_on date not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'running', 'closed')),
  -- Collective targets shown on the public page: kilometres, hours, amount.
  collective_goals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint editions_dates_are_ordered check (ends_on >= starts_on),
  constraint editions_registration_opens_before_start
    check (registration_opens_on <= starts_on)
);

comment on table public.editions is
  'One row per yearly edition. Content is attached to an edition so a new one needs data, not code.';

-- -------------------------------------------------------------------------
-- profiles
--
-- Extends auth.users with what the game needs. Deliberately minimal: the
-- less personal data this table holds, the less there is to leak.
-- -------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Public alias, shown in leaderboards. Never the civil name: rankings are
  -- public, and a pseudonym is the project's first act of data minimisation.
  display_name text not null,
  email text,
  avatar_url text,
  role text not null default 'participant'
    check (role in ('participant', 'admin')),
  created_at timestamptz not null default now(),
  -- Soft deletion: accounting rows must survive account removal (legal
  -- obligation), so the profile is anonymised rather than dropped.
  deleted_at timestamptz,

  constraint profiles_display_name_length
    check (char_length(display_name) between 2 and 30)
);

comment on table public.profiles is
  'Game profile, one per auth user. Holds a pseudonym, never a civil name.';

-- Case-insensitive uniqueness: "MoustacheDor" and "moustachedor" must not
-- coexist, or impersonation in the leaderboard becomes trivial.
create unique index profiles_display_name_unique
  on public.profiles (lower(display_name))
  where deleted_at is null;

create index profiles_role_idx on public.profiles (role)
  where role = 'admin';

-- -------------------------------------------------------------------------
-- Automatic profile creation
--
-- Runs on every signup so a user can never exist without a profile — a state
-- that would break every page that joins on it.
--
-- `security definer` is required to write into public.profiles from an
-- auth.users trigger. `set search_path = ''` is what makes that safe: without
-- it, a malicious schema earlier in the path could shadow `profiles` and
-- capture the insert.
-- -------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    -- Falls back to a unique placeholder: the signup form supplies the real
    -- one, but a profile must exist even if it does not.
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      'participant-' || substr(new.id::text, 1, 8)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- Admin check
--
-- Used by policies below. Wrapped in a function so the rule lives in one
-- place: changing how an admin is identified must never mean editing a
-- dozen policies.
-- -------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and deleted_at is null
  );
$$;

-- -------------------------------------------------------------------------
-- Row level security
--
-- Enabled on every table, without exception. A page with a bug must not be
-- able to leak another participant's data: the database refuses, not the code.
-- -------------------------------------------------------------------------
alter table public.editions enable row level security;
alter table public.profiles enable row level security;

-- editions ---------------------------------------------------------------

-- Anyone, signed in or not, may read a published edition: the public home
-- page needs its dates and collective goals.
create policy "editions are publicly readable once published"
  on public.editions for select
  using (status <> 'draft');

create policy "admins read every edition"
  on public.editions for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write editions"
  on public.editions for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- profiles ---------------------------------------------------------------

-- Strictly private. A participant reads their own row and nothing else.
-- Other participants see only the pseudonym, through the view below — the
-- e-mail address is never exposed to anyone but its owner and the admins.
create policy "participants read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "participants update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "admins read every profile"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

create policy "admins update every profile"
  on public.profiles for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No insert policy on purpose: profiles are created by the signup trigger
-- alone. No delete policy either: removal goes through the account deletion
-- flow (story 11.2), which anonymises rather than drops.

-- -------------------------------------------------------------------------
-- Public view of profiles
--
-- Row level security filters rows, not columns. Letting participants read
-- each other's pseudonyms through the table would also hand them the e-mail
-- addresses. This view exposes the three harmless columns and nothing else.
--
-- It runs with the definer's rights (the Postgres default for views), which
-- is exactly what is wanted here: it deliberately bypasses the strict policy
-- on `profiles` while narrowing what can be read.
-- -------------------------------------------------------------------------
create view public.public_profiles as
  select id, display_name, avatar_url
  from public.profiles
  where deleted_at is null;

comment on view public.public_profiles is
  'Pseudonym and avatar only. The single sanctioned way to read another participant.';

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
