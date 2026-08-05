-- =========================================================================
-- DEFI Movember — consent to the processing of activity data (story 3.2)
--
-- Sporting activity data is sensitive: location, pace, health. The market is
-- France and the EU, so the consent has to be free, specific, informed and
-- unambiguous (FR23). "Specific" is the word that decides the shape: folding
-- it into the acceptance of the terms of sale makes it legally worthless.
--
-- An append-only log of events, not a flag on the profile.
--
-- A flag answers "does this person consent right now?" and nothing else. What
-- has to be answerable, months later and to somebody who was not there, is
-- "on what date did they consent, to which version of which text, and when
-- did they withdraw it?" A flag that was flipped twice has forgotten the
-- first time. This table cannot forget: there is no update policy and no
-- delete policy, for anyone — not even an administrator.
-- =========================================================================

create table public.activity_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  action text not null check (action in ('granted', 'withdrawn')),

  -- Which text was in force. The date alone proves nothing — the wording
  -- will be rewritten before registrations open, exactly as for the terms of
  -- sale (story 2.2). Only a grant carries one: a withdrawal withdraws
  -- whatever was in force.
  version text,

  created_at timestamptz not null default now(),

  constraint activity_consents_grant_has_version check (
    action <> 'granted' or version is not null
  )
);

comment on table public.activity_consents is
  'Append-only log of consent to activity data processing. The current state is the latest row.';

-- The current state is the latest row for a profile.
create index activity_consents_profile_idx
  on public.activity_consents (profile_id, created_at desc);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.activity_consents enable row level security;

create policy "participants read their own consent history"
  on public.activity_consents for select
  to authenticated
  using ((select auth.uid()) = profile_id);

-- Written under one's own name, and only under one's own name. `profile_id`
-- is checked against the session rather than trusted from the request: there
-- is no way to consent on somebody else's behalf, which is the one thing a
-- consent record must never allow.
create policy "participants record their own consent"
  on public.activity_consents for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

-- Administrators read it, because "did this person consent before their
-- activities were collected?" is a question the association may have to
-- answer to a regulator, and it cannot be answered from the participant's
-- own screen.
create policy "admins read the consent history"
  on public.activity_consents for select
  to authenticated
  using ((select public.is_admin()));

-- No update policy and no delete policy, deliberately. A consent record that
-- can be corrected after the fact is a consent record that proves nothing —
-- the same reasoning as the administrative audit log of story 1.10.
-- Withdrawing consent adds a row; it never edits one.
