-- =========================================================================
-- DEFI Movember — cards, rarities and grants (story 5.1)
--
-- What turns a sport-tracking application into a game. The immediate reward
-- and the collection are the retention engine over thirty days (PRD D10).
-- =========================================================================

-- -------------------------------------------------------------------------
-- card_rarities — the four tiers, and their draw weights
--
-- **A table rather than an enum, because the weights have to move.** A
-- legendary that is too rare demoralises; one that is too common is worth
-- nothing — and nobody will know which until November is under way.
-- Adjusting them has to take one SQL statement, never a deployment
-- (architecture D2).
-- -------------------------------------------------------------------------
create table public.card_rarities (
  slug text primary key check (
    slug in ('commune', 'rare', 'epique', 'legendaire')
  ),
  label text not null,

  -- Relative, not a percentage: weights of 60/28/10/2 and 600/280/100/20
  -- describe the same game. Relative weights can be nudged one at a time
  -- without having to make the others add up again.
  weight integer not null check (weight >= 0),

  -- Highest first. Used for the fallback when a rarity has nothing to give.
  rank integer not null unique,

  created_at timestamptz not null default now()
);

comment on table public.card_rarities is
  'The four rarities and their relative draw weights. Weights are tuned in SQL, never in code.';

insert into public.card_rarities (slug, label, weight, rank) values
  -- The starting point of PRD point A12, to be calibrated during the
  -- edition. 2 % on the legendary is what keeps it an event without making
  -- it unreachable.
  ('commune', 'Commune', 60, 1),
  ('rare', 'Rare', 28, 2),
  ('epique', 'Épique', 10, 3),
  ('legendaire', 'Légendaire', 2, 4);

-- -------------------------------------------------------------------------
-- cards — the catalogue
-- -------------------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  rarity text not null references public.card_rarities (slug),

  -- Where the picture lives, once there is one. Empty until then, and the
  -- album draws a placeholder rather than a broken image (story 5.4 AC 5):
  -- the visuals are a September job, and the game has to be playable before
  -- they exist.
  image_path text not null default '',

  -- Nothing is drawn before this is set. It is what lets a card be added
  -- mid-month, picture and all, without a deployment.
  published_at timestamptz,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cards is
  'Card catalogue. A card is drawable only once published; a published card is never deleted.';

create index cards_drawable_idx
  on public.cards (edition_id, rarity)
  where published_at is not null;

-- -------------------------------------------------------------------------
-- card_grants — who got what, and how
--
-- **The `source` column carries the integrity of the collection ranking on
-- its own** (architecture D8, NFR20). The PRD forbids any advantage obtained
-- by paying; without this column a card from a paid pack would be
-- indistinguishable from a card that was earned, and the collection ranking
-- would mean nothing at all.
-- -------------------------------------------------------------------------
create table public.card_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete restrict,

  -- Only `challenge` and `daily_draw` count towards the ranking. The others
  -- enrich a collection and nothing else.
  source text not null check (
    source in ('challenge', 'daily_draw', 'pack', 'purchase', 'manual')
  ),

  -- Which challenge earned it, when one did. Null for a pack or a purchase.
  assignment_id uuid references public.challenge_assignments (id)
    on delete set null,

  granted_at timestamptz not null default now()
);

comment on table public.card_grants is
  'One card handed to one participant. `source` decides whether it counts towards the collection ranking (architecture D8).';

comment on column public.card_grants.source is
  'challenge and daily_draw count towards the ranking. pack, purchase and manual never do.';

-- One challenge, one card. Ever.
--
-- Not a precaution: an evaluation replayed by a catch-up, two activities
-- arriving together, a webhook and an hourly task landing on the same
-- challenge — each of those would pass a check made in the application, and
-- hand out a second card. The database refuses it, and the caller reads the
-- refusal as "already done".
create unique index card_grants_one_per_assignment
  on public.card_grants (assignment_id)
  where assignment_id is not null;

create index card_grants_collection_idx
  on public.card_grants (profile_id, card_id);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.card_rarities enable row level security;
alter table public.cards enable row level security;
alter table public.card_grants enable row level security;

-- The rarities are public: the album names them, and so will the public
-- gallery of story 5.8. There is nothing personal in a weight.
create policy "everyone reads the rarities"
  on public.card_rarities for select
  to anon, authenticated
  using (true);

create policy "only admins change the rarities"
  on public.card_rarities for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- A published card is public — the album shows what is missing, and the
-- gallery of story 5.8 shows the lot. An UNPUBLISHED card is not: it is the
-- surprise of a card nobody has seen yet.
create policy "everyone reads published cards"
  on public.cards for select
  to anon, authenticated
  using (published_at is not null);

create policy "admins read the whole catalogue"
  on public.cards for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write the catalogue"
  on public.cards for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "participants read their own collection"
  on public.card_grants for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every collection"
  on public.card_grants for select
  to authenticated
  using ((select public.is_admin()));

-- No write policy on `card_grants`, for anyone — the same rule as
-- `challenge_assignments` and `activities`, for the same reason. Cards are
-- handed out server-side with the service key. Somebody able to insert here
-- would grant themselves the legendary, and the collection ranking is
-- exactly what that would destroy.
