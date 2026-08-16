-- =========================================================================
-- DEFI Movember — registration tiers, registrations and payments (story 2.1)
--
-- The money side. Three tables, and the rules around them matter more than
-- their columns.
--
-- Nothing here can be written by a participant. Not a registration, not a
-- payment. Those rows are created server-side by the Stripe webhook, which
-- acts in nobody's name. A participant able to insert their own registration
-- could enrol without paying — the most obvious hole in the whole epic, and
-- it is the database that must close it, not the application.
-- =========================================================================

-- -------------------------------------------------------------------------
-- registration_tiers — what is on sale
--
-- In the database rather than in the code because a price must be changeable
-- without a deployment. The medal quote is not firm, and these amounts may
-- move before registration opens (PRD D1).
-- -------------------------------------------------------------------------
create table public.registration_tiers (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  -- Stable identifier used by the application. The name can be reworded; this
  -- cannot, without breaking every link already shared.
  slug text not null check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),

  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '',

  -- Cents, always. 12,10 € is not representable in binary, and the rounding
  -- ends up in the association's accounts.
  price_cents integer not null check (price_cents > 0),

  -- What the association commits to handing to the Movember Foundation.
  -- Never more than what was collected.
  donated_cents integer not null check (donated_cents > 0),

  -- One line per perk, displayed in order.
  perks text[] not null default '{}',

  position integer not null default 0,
  -- Lets a tier be withdrawn from sale without deleting it — the payments
  -- that reference it must survive.
  available boolean not null default true,

  created_at timestamptz not null default now(),

  constraint registration_tiers_slug_unique unique (edition_id, slug),
  constraint registration_tiers_donation_within_price
    check (donated_cents <= price_cents)
);

comment on table public.registration_tiers is
  'The three registration levels. Amounts in cents, editable without a deployment.';

create index registration_tiers_edition_idx
  on public.registration_tiers (edition_id, position);

-- -------------------------------------------------------------------------
-- registrations — who is taking part
-- -------------------------------------------------------------------------
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete restrict,

  -- `restrict`: a tier that has been paid for cannot be deleted. Withdraw it
  -- from sale with `available` instead.
  tier_id uuid not null references public.registration_tiers (id) on delete restrict,

  -- `pending` until the webhook confirms. Nothing in the game is reachable
  -- before `active` (FR12).
  status text not null default 'pending'
    check (status in ('pending', 'active', 'refunded', 'cancelled')),

  created_at timestamptz not null default now(),
  activated_at timestamptz,

  -- Set once the welcome e-mail has gone out, so a replayed webhook does not
  -- send it twice (story 2.5). A marker in the database rather than a check
  -- in the code: two processes can handle the same webhook at once.
  welcome_email_sent_at timestamptz,

  -- One registration per person per edition, enforced here and not by a
  -- `select` in the application — which two concurrent requests would both
  -- pass.
  constraint registrations_one_per_edition unique (profile_id, edition_id)
);

comment on table public.registrations is
  'One row per participant per edition. Created and activated server-side only.';

create index registrations_edition_status_idx
  on public.registrations (edition_id, status);

-- -------------------------------------------------------------------------
-- payments — the accounts, immutable
--
-- The association hands money to a foundation and has to justify it. Every
-- line must reconcile with the Stripe statement, item by item (NFR15), which
-- is only true if a line never changes after the fact.
-- -------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),

  -- Nullable so a payment survives a registration being removed: the money
  -- moved, and the accounts must say so whatever happens to the account.
  registration_id uuid references public.registrations (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  edition_id uuid not null references public.editions (id) on delete restrict,

  -- `pack` arrives with epic 10. Named now so the accounting export written
  -- in epic 9 does not have to be reshaped later.
  kind text not null default 'registration'
    check (kind in ('registration', 'pack', 'refund')),

  -- Reconciliation with the Stripe statement.
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,

  -- Its own copy of the amounts, NOT a reference to the tier. If the split
  -- changes mid-edition, payments already taken must not change with it
  -- (architecture D12).
  gross_cents integer not null,
  -- Nullable, and that is not an oversight: Stripe does not know the fee at
  -- the moment of the webhook. It is filled in by story 2.6, from the real
  -- balance transaction — never estimated.
  fee_cents integer,
  net_cents integer,
  donation_cents integer not null,
  counterpart_cents integer not null default 0,

  created_at timestamptz not null default now(),

  -- What makes a replayed webhook harmless. Stripe resends anything that did
  -- not answer within a few seconds, and sends several events per payment.
  -- The database refuses the duplicate; no `if` in the application could do
  -- it reliably (NFR16).
  constraint payments_session_unique unique (stripe_session_id),
  constraint payments_intent_unique unique (stripe_payment_intent_id),
  constraint payments_amounts_are_consistent
    check (donation_cents + counterpart_cents <= gross_cents)
);

comment on table public.payments is
  'Accounting record. Append-only: no update or delete policy exists, on purpose.';

comment on column public.payments.fee_cents is
  'Real Stripe fee, filled in once the balance transaction is known. Null means not yet known — never zero.';

create index payments_edition_idx on public.payments (edition_id, created_at desc);
create index payments_profile_idx on public.payments (profile_id);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.registration_tiers enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;

-- Tiers: readable by anyone, signed in or not. The public home page shows
-- the prices and must not need a session to do it.
create policy "tiers are publicly readable"
  on public.registration_tiers for select
  using (true);

create policy "only admins write tiers"
  on public.registration_tiers for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Registrations: strictly one's own.
create policy "participants read their own registration"
  on public.registrations for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every registration"
  on public.registrations for select
  to authenticated
  using ((select public.is_admin()));

-- Payments: same, and read-only for everyone.
create policy "participants read their own payments"
  on public.payments for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every payment"
  on public.payments for select
  to authenticated
  using ((select public.is_admin()));

-- NO insert, update or delete policy on `registrations` or on `payments`,
-- for anyone — not even an administrator.
--
-- Registrations and payments are written by the Stripe webhook, server-side,
-- with the service key, which bypasses these rules by design. Everything
-- else in the application reads. A refund (story 2.8) adds a line; it never
-- edits one.
