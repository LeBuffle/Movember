-- =========================================================================
-- DEFI Movember — notification preferences (story 6.7)
--
-- A right as much as a comfort: the GDPR right to object is exercised here,
-- by category (architecture §8.4, FR26). "Everything or nothing" would push
-- someone annoyed by one category into switching off the daily challenge —
-- the one message the whole game depends on.
-- =========================================================================

create table public.notification_preferences (
  -- The profile is the key. One row per participant, or none at all.
  profile_id uuid primary key references public.profiles (id) on delete cascade,

  -- Channels. Cutting one leaves the other working, which is the point: a
  -- participant may want the daily reminder by e-mail and nothing on their
  -- phone.
  channel_push boolean not null default true,
  channel_email boolean not null default true,

  -- Categories, one column each rather than an array or a jsonb blob.
  -- Adding a category is then a migration that fails loudly if some code
  -- still expects the old shape — where a blob would quietly return null and
  -- be read as "not interested".
  cat_defi_du_jour boolean not null default true,
  cat_resultat boolean not null default true,
  cat_carte boolean not null default true,
  cat_annonce boolean not null default true,
  cat_relance boolean not null default true,

  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'One row per participant, or none. No row means everything is on: silence is not a refusal (story 6.7 AC 4).';

-- -------------------------------------------------------------------------
-- Access rules
--
-- **A participant writes their own row, and here that is safe** — unlike
-- `push_subscriptions` next door. The difference is worth stating, because
-- the two tables look alike and are governed opposite ways: every column
-- below belongs to the participant and means only what they want. There is
-- no bookkeeping the sender relies on, so there is nothing a participant
-- could rewrite to their advantage. The worst they can do to themselves is
-- receive nothing, which is precisely the right being exercised.
-- -------------------------------------------------------------------------

alter table public.notification_preferences enable row level security;

create policy "participants read their own preferences"
  on public.notification_preferences for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "participants write their own preferences"
  on public.notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "participants change their own preferences"
  on public.notification_preferences for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- Admins read, so a "why did this person get nothing" question has an
-- answer. They never write: a preference changed by the organisation would
-- be the opposite of a right to object.
create policy "admins read the preferences"
  on public.notification_preferences for select
  to authenticated
  using ((select public.is_admin()));

-- No delete policy. Deleting a row would silently restore every category —
-- and to the participant, that reads as the organisation having ignored them.
