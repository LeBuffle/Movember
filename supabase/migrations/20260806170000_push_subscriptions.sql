-- =========================================================================
-- DEFI Movember — push subscriptions (story 6.1)
--
-- What makes a daily game come back to the participant instead of waiting to
-- be opened. A game with a challenge every day and no daily reminder loses
-- its players in a week (PRD, epic 6).
-- =========================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- The push service's address for this browser, on this device. It is what
  -- identifies a subscription — not the participant, who legitimately has
  -- several.
  endpoint text not null,

  -- The two keys the browser generated for us, needed to encrypt a payload
  -- so that only this browser can read it. Public material, not credentials:
  -- they authorise nothing anywhere else, which is why this table can carry
  -- them without the precautions `activity_connections` needs.
  p256dh text not null,
  auth text not null,

  -- Only to help somebody recognise their own devices in a list. Never used
  -- to decide anything.
  user_agent text,

  created_at timestamptz not null default now(),
  last_success_at timestamptz,

  -- Bookkeeping written by the sender (story 6.3). A push service that
  -- answers "gone" means the browser is gone — uninstalled, wiped, replaced.
  failure_count integer not null default 0,
  disabled_at timestamptz
);

comment on table public.push_subscriptions is
  'One browser on one device. A participant may hold several, and receives on all of them.';

-- One row per endpoint, whoever it belongs to.
--
-- A browser may hand back an endpoint it had already given, or re-issue one
-- after a rotation. Without this, a participant who allows notifications
-- twice would get every notification twice — and the second one reads as a
-- bug in the game, not in the browser.
create unique index push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

-- The send list: whom to write to, skipping what is dead.
create index push_subscriptions_live_idx
  on public.push_subscriptions (profile_id)
  where disabled_at is null;

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.push_subscriptions enable row level security;

-- A participant sees their own devices, so a list of "three devices linked"
-- can be shown and one of them removed knowingly.
create policy "participants read their own subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = profile_id);

-- No write policy, for anybody — the same rule as `activity_connections` and
-- `card_grants`, and here for a specific reason rather than by habit.
--
-- `failure_count`, `last_success_at` and `disabled_at` are the sender's
-- bookkeeping: they are how a dead endpoint gets retired (story 6.3 AC 3).
-- Row level security filters ROWS, not COLUMNS, so any policy letting a
-- participant write their own row would also let them reset that
-- bookkeeping — and a subscription that can never be retired makes the
-- failure rate climb month after month until it hides the real outages.
--
-- Subscribing therefore goes through a server action that checks the session
-- and writes with the service key.
