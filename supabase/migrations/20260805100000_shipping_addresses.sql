-- =========================================================================
-- DEFI Movember — where the counterparts get sent (story 2.7)
--
-- The most personal data in the whole project. A pseudonym and a running time
-- are one thing; a name and a street address are another, and the difference
-- shows in how this table is treated: its own table rather than columns on a
-- profile, so that reading a participant never means reading their address,
-- and so that erasing it is one statement rather than an audit.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Which tiers need an address at all
--
-- A column rather than a rule in the code. "Tiers two and three" is true
-- today and stops being true the moment a tier is added, reordered or
-- withdrawn — and nothing would say so. The tier itself declares whether
-- something has to be posted.
-- -------------------------------------------------------------------------
alter table public.registration_tiers
  add column if not exists requires_shipping boolean not null default false;

comment on column public.registration_tiers.requires_shipping is
  'Whether this tier has something physical to post, and therefore needs an address.';

-- -------------------------------------------------------------------------
-- shipping_addresses
--
-- Free-text fields on purpose. The market is France and the EU; a strict
-- format check would reject valid addresses — a "lieu-dit" with no street
-- number, a "BP", a foreign postcode — for no benefit at this scale. The
-- lengths are bounded, which is a different matter: that is about what a
-- database column can be made to hold, not about what an address looks like.
-- -------------------------------------------------------------------------
create table public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),

  -- `cascade`: deleting the account takes the address with it, without
  -- anything having to remember (story 2.7 AC 7, epic 11).
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,

  -- Not read from the profile: the parcel may go to someone else's name —
  -- a workplace, a parent's house — and the pseudonym is no use to a postman.
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),

  line1 text not null check (char_length(line1) between 2 and 160),
  line2 text check (char_length(line2) <= 160),
  postal_code text not null check (char_length(postal_code) between 2 and 16),
  city text not null check (char_length(city) between 1 and 100),

  -- ISO 3166-1 alpha-2. France by default, which is where nearly all of them
  -- will be, and the field stays visible so nobody discovers in December that
  -- a Belgian parcel was addressed to France.
  country text not null default 'FR' check (country ~ '^[A-Z]{2}$'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One address per person per edition. The parcel goes to one place.
  constraint shipping_addresses_one_per_edition unique (profile_id, edition_id)
);

comment on table public.shipping_addresses is
  'Postal addresses for the counterparts. The most personal data in the project.';

create index shipping_addresses_edition_idx
  on public.shipping_addresses (edition_id);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.shipping_addresses enable row level security;

-- Strictly one's own. Unlike the rest of the participant's data, there is no
-- public view of any part of this and there never will be.
create policy "participants read their own address"
  on public.shipping_addresses for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "participants write their own address"
  on public.shipping_addresses for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "participants correct their own address"
  on public.shipping_addresses for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- Erasing one's own address without erasing the account. The right to have
-- it removed does not depend on giving up the game.
create policy "participants erase their own address"
  on public.shipping_addresses for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

-- Administrators read, because someone has to write the labels. They do not
-- write: an address corrected by an organiser rather than by the person it
-- belongs to is an address nobody can be held to.
create policy "admins read every address"
  on public.shipping_addresses for select
  to authenticated
  using ((select public.is_admin()));

-- -------------------------------------------------------------------------
-- Which tiers post something, for the 2026 edition
-- -------------------------------------------------------------------------
update public.registration_tiers
  set requires_shipping = true
  where slug in ('chevronne', 'legendaire');
