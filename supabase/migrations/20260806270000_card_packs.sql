-- =========================================================================
-- DEFI Movember — buyable card packs (story 10.1)
--
-- Extra revenue, handed over in full, and a little more pleasure for the
-- players who want it. **Nothing bought here ever improves a ranking**
-- (PRD D2, FR72): the cards a purchase produces carry `source = 'purchase'`,
-- and the collection ranking counts only `challenge` and `daily_draw`.
--
-- That rule is not a display choice, it is the reason the ranking can be
-- defended out loud — and it is already enforced, one level down, by the
-- materialised view of story 7.3.
-- =========================================================================

-- -------------------------------------------------------------------------
-- card_packs — what is on sale
--
-- In the database rather than in the code, for the same reason as the
-- registration tiers: the price of a pack is decision P3 and is not settled.
-- Moving it must take one SQL statement, never a deployment.
-- -------------------------------------------------------------------------
create table public.card_packs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  slug text not null check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '',

  -- Cents, always.
  price_cents integer not null check (price_cents > 0),

  -- What the association commits to handing to the foundation.
  --
  -- **Equal to the price, and the database says so.** A pack posts nothing
  -- and prints nothing: there is no counterpart to fund, so the whole amount
  -- is reversable, and the shop says that in so many words. Should a pack
  -- ever carry a physical reward, this constraint is one line to relax — and
  -- relaxing it deliberately is the point.
  donated_cents integer not null check (donated_cents > 0),

  -- Composition. Both live here so a pack can be reshaped mid-November
  -- without a deployment (PRD FR66).
  card_count integer not null default 5 check (card_count between 1 and 20),

  -- The floor, not the ceiling: the other cards are drawn normally, so a
  -- pack can hold two legendaries. Null means "no guarantee", which is a
  -- legitimate pack and a cheaper one.
  guaranteed_rarity text references public.card_rarities (slug),

  position integer not null default 0,
  -- Withdraws a pack from sale without deleting it: the purchases that
  -- reference it must survive.
  available boolean not null default true,

  created_at timestamptz not null default now(),

  constraint card_packs_slug_unique unique (edition_id, slug),
  constraint card_packs_fully_donated check (donated_cents = price_cents)
);

comment on table public.card_packs is
  'Packs on sale. Price and composition are edited in SQL, never in code (PRD FR66).';

comment on column public.card_packs.donated_cents is
  'Equal to the price by constraint: a pack has no physical counterpart, so the whole amount is reversable.';

create index card_packs_edition_idx
  on public.card_packs (edition_id, position);

-- -------------------------------------------------------------------------
-- pack_purchases — who bought what, and what they were promised
--
-- **The composition is copied onto the row, not referenced.** Same rule as
-- the payment amounts (architecture D12): a pack sold on 5 November with a
-- guaranteed epic must deliver a guaranteed epic, even if the pack is
-- reshaped on the 10th. A reference would rewrite the past.
-- -------------------------------------------------------------------------
create table public.pack_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete restrict,

  -- `restrict`: a pack that has been bought cannot be deleted. Withdraw it
  -- from sale with `available` instead.
  pack_id uuid not null references public.card_packs (id) on delete restrict,

  -- `pending` until the webhook confirms. No card is handed over before
  -- `paid` (architecture D5) — the return from Stripe proves nothing.
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'abandoned')),

  -- The promise, frozen at the moment of sale.
  price_cents integer not null check (price_cents > 0),
  card_count integer not null check (card_count between 1 and 20),
  guaranteed_rarity text references public.card_rarities (slug),

  stripe_session_id text,

  created_at timestamptz not null default now(),
  paid_at timestamptz,

  constraint pack_purchases_session_unique unique (stripe_session_id)
);

comment on table public.pack_purchases is
  'One pack bought by one participant. The composition is a snapshot: what was promised is what is delivered.';

create index pack_purchases_profile_idx
  on public.pack_purchases (profile_id, created_at desc);

create index pack_purchases_edition_idx
  on public.pack_purchases (edition_id, status);

-- -------------------------------------------------------------------------
-- The link between a purchase and the cards it produced
--
-- Lets the participant see "les 5 cartes de ce pack" rather than five cards
-- that appeared, and — more importantly — makes the grant replay-safe: the
-- guard against handing out ten cards for one payment is a count of the rows
-- already carrying this purchase.
-- -------------------------------------------------------------------------
alter table public.card_grants
  add column pack_purchase_id uuid
    references public.pack_purchases (id) on delete set null;

comment on column public.card_grants.pack_purchase_id is
  'Which purchase produced this card. Null for everything earned by playing.';

create index card_grants_purchase_idx
  on public.card_grants (pack_purchase_id)
  where pack_purchase_id is not null;

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.card_packs enable row level security;
alter table public.pack_purchases enable row level security;

-- The shop is readable by anyone signed in. Not by `anon`: a pack is bought
-- from inside the game, and the public page has no business advertising it —
-- the entry funnel sells registrations, nothing else.
create policy "participants read the packs on sale"
  on public.card_packs for select
  to authenticated
  using (available);

create policy "admins read every pack"
  on public.card_packs for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write the packs"
  on public.card_packs for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "participants read their own purchases"
  on public.pack_purchases for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every purchase"
  on public.pack_purchases for select
  to authenticated
  using ((select public.is_admin()));

-- No write policy on `pack_purchases`, for anybody — the same rule as
-- `registrations` and `card_grants`, for the same reason.
--
-- Row level security filters ROWS, not COLUMNS. Somebody allowed to write
-- their own purchase row would be allowed to write `status` in the same
-- statement, and would hand themselves a paid pack for nothing. Purchases
-- are created and settled server-side with the service key, and only the
-- webhook moves one to `paid` (architecture D5).
