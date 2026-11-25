-- =========================================================================
-- DEFI Movember — player duels and the credit wallet (epic 12)
--
-- The first mechanism where two participants act on each other. Everything
-- else in the game is played side by side; here somebody is named.
--
-- Three rules run through this whole file, and each one is enforced by the
-- database rather than by the application:
--
-- 1. **A duel wins nothing** (decision P7). No points, no card, no rank.
--    That single decision is what removes the need for a daily point cap, for
--    recurring-pair detection, and for any arbitration: two friends sending
--    each other duels all day have nothing to gain by it.
-- 2. **A balance is a sum of movements, never a counter.** A stored counter
--    gets corrected by hand the day it is wrong, and nobody ever knows why
--    again. Same reasoning as `payments`, which has been append-only since
--    story 2.1.
-- 3. **Nobody writes their own duel or their own balance.** Row level
--    security filters ROWS, not COLUMNS: somebody allowed to write their own
--    ledger row would write `delta` in the same statement.
-- =========================================================================

-- -------------------------------------------------------------------------
-- The cap lives on the edition
--
-- Five received duels per rolling 24 hours, and the figure is data rather
-- than code: the PO can move it in one SQL statement on 3 November, which is
-- exactly when he will want to.
-- -------------------------------------------------------------------------
alter table public.editions
  add column if not exists duel_cap_per_day integer not null default 5
    check (duel_cap_per_day between 1 and 50);

comment on column public.editions.duel_cap_per_day is
  'How many duels one participant can receive per rolling 24 h. Free ripostes do not count (epic 12, rule 2).';

-- -------------------------------------------------------------------------
-- "Ne pas me défier"
--
-- The cap protects against a flood, not against persistence: five a day over
-- thirty days is a hundred and fifty duels aimed at somebody who never asked
-- to play at this. The game is aimed at colleagues and friends who know each
-- other, and the mechanism consists of naming somebody — which is exactly the
-- ground where a joke becomes harassment without anybody meaning it to.
--
-- On `profiles`, which the participant may update themselves. That is
-- correct here and deliberate: the worst they can do with this column is stop
-- receiving duels, which is the right being exercised.
-- -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists duels_opt_out boolean not null default false;

comment on column public.profiles.duels_opt_out is
  'Set by the participant in « Mon compte ». No duel and no riposte reaches them while it is true (decision P9).';

/*
 * The switch joins the public view.
 *
 * Row level security stops one participant from reading another's `profiles`
 * row, which is right — that row holds an e-mail address. But the ranking has
 * to know whether to offer a "Défier" button, and offering one that is always
 * refused is worse than not offering it.
 *
 * What is exposed is exactly what the absent button already says out loud:
 * this person does not accept duels. Nothing else about them travels.
 */
create or replace view public.public_profiles as
  select id, display_name, avatar_url, duels_opt_out
  from public.profiles
  where deleted_at is null;

comment on view public.public_profiles is
  'Pseudonym, avatar, and whether duels are accepted. The single sanctioned way to read another participant.';

-- -------------------------------------------------------------------------
-- duel_types — the three duels, in the database
--
-- Fixed catalogue, and fixed on purpose: a duel is aimed at somebody, so it
-- is not the place for free text. What is in the database is which three, at
-- what threshold, and for how long — all changeable without a deployment.
--
-- `collective` is excluded by constraint: a goal reached by everybody
-- together cannot be a duel between two people.
-- -------------------------------------------------------------------------
create table public.duel_types (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  slug text not null check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  -- One line, shown to the person receiving it. Written by the association.
  tagline text not null default '',

  evaluator text not null
    check (evaluator in ('distance', 'duration', 'elevation', 'multisport', 'surprise')),
  config jsonb not null default '{}'::jsonb,

  -- How long the receiver has. 24 h is the rule; the column is what makes it
  -- a rule and not a constant.
  hours integer not null default 24 check (hours between 1 and 168),

  position integer not null default 0,
  available boolean not null default true,

  created_at timestamptz not null default now(),

  constraint duel_types_slug_unique unique (edition_id, slug)
);

comment on table public.duel_types is
  'The three fixed duels. Threshold and delay are edited in SQL, never in code (story 12.1 AC 5).';

create index duel_types_edition_idx
  on public.duel_types (edition_id, position);

-- -------------------------------------------------------------------------
-- duel_credit_lots — what is on sale
--
-- **Lots rather than a payment per duel, and it is money rather than
-- comfort.** Stripe takes about 1,4 % + 0,25 € per transaction: on a single
-- 2 € duel that is 14 % of the amount, against 3,9 % on a 10 € lot. Paying
-- duel by duel would leave a seventh of this revenue at Stripe, and
-- `CLAUDE.md` §10 settles it on its own — every euro of technical cost is a
-- euro less for the collection.
-- -------------------------------------------------------------------------
create table public.duel_credit_lots (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  slug text not null check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '',

  credits integer not null check (credits between 1 and 100),
  price_cents integer not null check (price_cents > 0),

  -- Equal to the price, by constraint, exactly like a card pack: a credit
  -- posts nothing and prints nothing, so the whole amount is reversable. The
  -- unspent ones are handed over too (decision P8), which is why the figure
  -- can be stated without a caveat.
  donated_cents integer not null check (donated_cents > 0),

  position integer not null default 0,
  available boolean not null default true,

  created_at timestamptz not null default now(),

  constraint duel_credit_lots_slug_unique unique (edition_id, slug),
  constraint duel_credit_lots_fully_donated check (donated_cents = price_cents)
);

comment on table public.duel_credit_lots is
  'Credit lots on sale. 5 credits for 10 €, 10 for 20 € (decision P10) — the price lives here.';

create index duel_credit_lots_edition_idx
  on public.duel_credit_lots (edition_id, position);

-- -------------------------------------------------------------------------
-- duel_lot_purchases — one purchase, and what it promised
--
-- The count and the price are copied onto the row rather than referenced,
-- like every other purchase in the project (architecture D12): a lot sold on
-- 5 November delivers what was sold, even if the lot is reshaped on the 10th.
-- -------------------------------------------------------------------------
create table public.duel_lot_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete restrict,
  lot_id uuid not null references public.duel_credit_lots (id) on delete restrict,

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'abandoned')),

  -- The promise, frozen at the moment of sale.
  price_cents integer not null check (price_cents > 0),
  credits integer not null check (credits between 1 and 100),

  stripe_session_id text,

  created_at timestamptz not null default now(),
  paid_at timestamptz,

  constraint duel_lot_purchases_session_unique unique (stripe_session_id)
);

comment on table public.duel_lot_purchases is
  'One lot of credits bought by one participant. Only the webhook moves it to paid (architecture D5).';

create index duel_lot_purchases_profile_idx
  on public.duel_lot_purchases (profile_id, created_at desc);

create index duel_lot_purchases_edition_idx
  on public.duel_lot_purchases (edition_id, status);

-- -------------------------------------------------------------------------
-- duels — who challenged whom, and what became of it
-- -------------------------------------------------------------------------
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,

  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  duel_type_id uuid not null references public.duel_types (id) on delete restrict,

  -- The free riposte a met duel opens (story 12.6). One per duel, and to its
  -- original sender only — both enforced below.
  parent_duel_id uuid references public.duels (id) on delete set null,
  free boolean not null default false,

  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,

  status text not null default 'open'
    check (status in ('open', 'met', 'expired')),

  met_at timestamptz,
  -- The provider's own identifier for the outing that settled it. Kept for
  -- the record and for a contested duel; it is not a foreign key because
  -- `activities` is keyed per provider.
  met_activity_id text,

  -- Which humorous line was drawn when it expired. Stored so the sender sees
  -- the same sentence every time they open the screen — a message that
  -- changes at each refresh reads as a bug.
  expiry_message_key text,

  created_at timestamptz not null default now(),

  -- Nobody duels themselves. In the database, because the check has to hold
  -- against a forged request as well as against a form.
  constraint duels_not_self check (sender_id <> receiver_id),
  constraint duels_window check (expires_at > sent_at),
  -- At most one riposte per duel. Nulls are distinct in Postgres, so this
  -- constrains ripostes without constraining anything else.
  constraint duels_one_riposte unique (parent_duel_id),
  constraint duels_met_has_time check (
    (status = 'met' and met_at is not null)
    or (status <> 'met' and met_at is null)
  )
);

comment on table public.duels is
  'One duel from one participant to another. Winning it earns nothing (decision P7).';

comment on column public.duels.free is
  'A riposte costs no credit and does not count towards the receiver''s cap.';

-- What the receiver's screen asks for: my open duels, soonest first.
create index duels_receiver_idx
  on public.duels (receiver_id, status, expires_at);

create index duels_sender_idx
  on public.duels (sender_id, sent_at desc);

-- What the rolling cap counts, and what the expiry task sweeps.
create index duels_cap_idx
  on public.duels (receiver_id, sent_at)
  where free = false;

create index duels_expiry_idx
  on public.duels (status, expires_at)
  where status = 'open';

-- -------------------------------------------------------------------------
-- duel_credit_entries — the ledger
--
-- **A ledger rather than a counter**, and the volume makes it free: ten
-- credits bought is one row, ten spent is ten. What it buys is an answer to
-- "j'ai payé et mon crédit a disparu" that does not require believing
-- anybody.
-- -------------------------------------------------------------------------
create table public.duel_credit_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,

  -- Signed. Positive credits, negative spends. Never zero: a movement that
  -- moves nothing is a line nobody can explain.
  delta integer not null check (delta <> 0 and delta between -100 and 100),

  reason text not null
    check (reason in ('achat', 'depense', 'retour', 'remboursement', 'ajustement')),

  duel_id uuid references public.duels (id) on delete set null,
  purchase_id uuid references public.duel_lot_purchases (id) on delete set null,
  -- Carried for traceability alongside the payment line. The unique
  -- constraint below is on the purchase, which is the thing that may not be
  -- credited twice.
  stripe_session_id text,

  note text check (note is null or char_length(note) <= 200),

  created_at timestamptz not null default now(),

  -- **This is what makes a replayed webhook harmless.** Stripe resends any
  -- event that did not answer in a few seconds; the second insert runs into
  -- this constraint instead of doubling somebody's balance.
  constraint duel_credit_entries_purchase_unique unique (purchase_id)
);

comment on table public.duel_credit_entries is
  'Every credit movement, dated and explained. The balance is their sum, never a stored figure (story 12.1 AC 1-2).';

create index duel_credit_entries_profile_idx
  on public.duel_credit_entries (profile_id, edition_id, created_at desc);

-- -------------------------------------------------------------------------
-- The balance, and the floor under it
-- -------------------------------------------------------------------------

create function public.duel_credit_balance(p_profile uuid, p_edition uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer
  from public.duel_credit_entries
  where profile_id = p_profile
    and edition_id = p_edition;
$$;

comment on function public.duel_credit_balance is
  'Sum of the movements. The only definition of a balance in this project.';

/*
 * A balance may never go below zero, and the guard lives in the same
 * statement as the write.
 *
 * **Two open tabs and two simultaneous sends would pass any check made in the
 * application**, however carefully written: both would read a balance of one
 * before either had spent it. The advisory lock serialises the check per
 * participant, and it is held to the end of the transaction — so the second
 * insert waits, then sums a total that already includes the first.
 */
create function public.forbid_negative_duel_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));

  if (
    select coalesce(sum(delta), 0)
    from public.duel_credit_entries
    where profile_id = new.profile_id
      and edition_id = new.edition_id
  ) < 0 then
    raise exception 'Solde de crédits insuffisant.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create trigger duel_credit_entries_never_negative
  after insert or update on public.duel_credit_entries
  for each row
  execute function public.forbid_negative_duel_balance();

-- -------------------------------------------------------------------------
-- send_duel — the debit and the duel, in one statement
--
-- **They cannot be two writes.** A credit taken with no duel sent is a
-- complaint; a duel sent with no credit taken is a hole. One function, one
-- transaction, and every refusal happens before anything is written — so a
-- refused send costs nothing rather than costing a credit that then has to be
-- given back.
--
-- Returns a status rather than raising, because every one of these outcomes
-- is an ordinary answer the screen has a sentence for.
-- -------------------------------------------------------------------------
create function public.send_duel(
  p_sender uuid,
  p_receiver uuid,
  p_edition uuid,
  p_duel_type uuid,
  p_parent uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours integer;
  v_cap integer;
  v_received integer;
  v_balance integer;
  v_free boolean := p_parent is not null;
  v_duel public.duels%rowtype;
begin
  if p_sender = p_receiver then
    return jsonb_build_object('status', 'self');
  end if;

  /* Both participants locked, smallest identifier first. The sender's balance
     and the receiver's cap are both read below, and locking in a fixed order
     is what stops two simultaneous sends in opposite directions from
     deadlocking on each other. */
  perform pg_advisory_xact_lock(
    hashtextextended(least(p_sender::text, p_receiver::text), 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(greatest(p_sender::text, p_receiver::text), 0)
  );

  select hours into v_hours
  from public.duel_types
  where id = p_duel_type
    and edition_id = p_edition
    and available;

  if v_hours is null then
    return jsonb_build_object('status', 'type-unavailable');
  end if;

  -- The receiver has to be somebody who is actually playing. A duel sent to
  -- an unfinished registration is a credit spent on nothing.
  if not exists (
    select 1
    from public.registrations r
    join public.profiles p on p.id = r.profile_id
    where r.profile_id = p_receiver
      and r.edition_id = p_edition
      and r.status = 'active'
      and p.suspended_at is null
      and p.deleted_at is null
  ) then
    return jsonb_build_object('status', 'receiver-unavailable');
  end if;

  -- The switch is checked here, on the server, at every send. The hidden
  -- button is a politeness; this is the protection.
  if (select duels_opt_out from public.profiles where id = p_receiver) then
    return jsonb_build_object('status', 'opted-out');
  end if;

  if v_free then
    -- A riposte answers a duel you received and met, and it goes back to the
    -- person who sent it. Anything else is not a riposte.
    if not exists (
      select 1
      from public.duels d
      where d.id = p_parent
        and d.receiver_id = p_sender
        and d.sender_id = p_receiver
        and d.status = 'met'
    ) then
      return jsonb_build_object('status', 'riposte-invalid');
    end if;

    if exists (select 1 from public.duels where parent_duel_id = p_parent) then
      return jsonb_build_object('status', 'already-riposted');
    end if;
  else
    /* The cap is rolling, not calendar. "Five a day" reset at midnight allows
       ten duels in two hours, at 23 h and at 1 h — which is precisely the
       evening somebody would want protecting from. */
    select duel_cap_per_day into v_cap
    from public.editions
    where id = p_edition;

    select count(*) into v_received
    from public.duels
    where receiver_id = p_receiver
      and edition_id = p_edition
      and free = false
      and sent_at > now() - interval '24 hours';

    if v_received >= coalesce(v_cap, 5) then
      return jsonb_build_object('status', 'capped');
    end if;

    v_balance := public.duel_credit_balance(p_sender, p_edition);

    if v_balance < 1 then
      return jsonb_build_object('status', 'no-credit', 'balance', v_balance);
    end if;
  end if;

  insert into public.duels (
    edition_id, sender_id, receiver_id, duel_type_id,
    parent_duel_id, free, sent_at, expires_at
  )
  values (
    p_edition, p_sender, p_receiver, p_duel_type,
    p_parent, v_free, now(), now() + make_interval(hours => v_hours)
  )
  returning * into v_duel;

  if not v_free then
    insert into public.duel_credit_entries (
      profile_id, edition_id, delta, reason, duel_id
    )
    values (p_sender, p_edition, -1, 'depense', v_duel.id);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'duel_id', v_duel.id,
    'expires_at', v_duel.expires_at,
    'free', v_free,
    'balance', public.duel_credit_balance(p_sender, p_edition)
  );
end;
$$;

comment on function public.send_duel is
  'Refuses before writing, then debits and creates in one transaction (story 12.3 AC 7).';

-- -------------------------------------------------------------------------
-- expire_duels — the silent end
--
-- An unmet duel has **no consequence** for the person who received it
-- (story 12.5 AC 7). This marks it done so the sender gets their sentence and
-- the screen stops counting down; nothing else happens.
-- -------------------------------------------------------------------------
create function public.expire_duels(p_message_keys text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  update public.duels
  set status = 'expired',
      -- Drawn once and stored: a sentence that changes at every refresh reads
      -- as a defect rather than as a joke.
      expiry_message_key = p_message_keys[
        1 + floor(random() * array_length(p_message_keys, 1))::integer
      ]
  where status = 'open'
    and expires_at <= now();

  get diagnostics v_expired = row_count;

  return v_expired;
end;
$$;

-- -------------------------------------------------------------------------
-- Access rules
--
-- **No write policy on `duels`, on `duel_credit_entries` or on
-- `duel_lot_purchases`, for anybody.** Row level security filters rows, not
-- columns: a participant allowed to write their own duel row would write
-- `status = 'met'` in the same statement, and one allowed to write their own
-- ledger row would write `delta`. Everything is written server-side, by the
-- functions above and by the webhook.
-- -------------------------------------------------------------------------

alter table public.duel_types enable row level security;
alter table public.duel_credit_lots enable row level security;
alter table public.duel_lot_purchases enable row level security;
alter table public.duels enable row level security;
alter table public.duel_credit_entries enable row level security;

create policy "participants read the duels on offer"
  on public.duel_types for select
  to authenticated
  using (available);

create policy "admins read every duel type"
  on public.duel_types for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write duel types"
  on public.duel_types for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "participants read the lots on sale"
  on public.duel_credit_lots for select
  to authenticated
  using (available);

create policy "admins read every lot"
  on public.duel_credit_lots for select
  to authenticated
  using ((select public.is_admin()));

create policy "only admins write lots"
  on public.duel_credit_lots for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "participants read their own lot purchases"
  on public.duel_lot_purchases for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every lot purchase"
  on public.duel_lot_purchases for select
  to authenticated
  using ((select public.is_admin()));

-- Both sides of a duel can read it, and nobody else. A duel is addressed:
-- it is not public the way a ranking is.
create policy "participants read the duels they are part of"
  on public.duels for select
  to authenticated
  using (
    (select auth.uid()) = sender_id or (select auth.uid()) = receiver_id
  );

create policy "admins read every duel"
  on public.duels for select
  to authenticated
  using ((select public.is_admin()));

create policy "participants read their own credit movements"
  on public.duel_credit_entries for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "admins read every credit movement"
  on public.duel_credit_entries for select
  to authenticated
  using ((select public.is_admin()));

-- -------------------------------------------------------------------------
-- Accounting: credits are a fourth kind of payment
--
-- Without their own kind, every lot sold would land in "encaissement sans
-- niveau rattaché" — the line that means *something is wrong* on the
-- collection screen. A dashboard that reports an anomaly at every sale is a
-- dashboard nobody reads (story 12.8).
-- -------------------------------------------------------------------------
alter table public.payments
  drop constraint if exists payments_kind_check;

alter table public.payments
  add constraint payments_kind_check
  check (kind in ('registration', 'pack', 'credits', 'refund'));
