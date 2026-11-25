-- =========================================================================
-- DEFI Movember — linked activity accounts (story 3.3)
--
-- Named for the abstraction, not for Strava (architecture D3). Garmin joins
-- this table after the launch by adding a `provider` value, not by adding a
-- table — and if Strava's terms ever impose a restriction, this is one of the
-- two places to adjust.
-- =========================================================================

create table public.activity_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  provider text not null check (provider in ('strava', 'manual', 'simulated')),
  -- The athlete's identifier AT the provider. This is what makes the
  -- one-account rule enforceable.
  provider_account_id text not null,

  -- Encrypted by the application before they get here (story 3.3 AC 5). A
  -- leaked database backup then hands over ciphertext rather than four
  -- hundred people's entire sporting history.
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,

  -- What the participant actually granted, as the provider reported it back.
  -- Recorded rather than assumed: somebody can approve a narrower scope than
  -- the one requested, and the failure that follows is otherwise a mystery.
  scopes text[] not null default '{}',

  -- `broken` is set when the provider refuses the refresh token (story 3.7):
  -- the participant revoked us, and hammering the door would only burn the
  -- application's call quota for everybody.
  status text not null default 'active'
    check (status in ('active', 'broken')),

  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  -- Unlinked without being deleted, so "this account was connected in
  -- November and unlinked in December" stays readable.
  disconnected_at timestamptz
);

comment on table public.activity_connections is
  'One linked activity account per participant per provider. Tokens are encrypted by the application; no read policy exists for anyone.';

-- -------------------------------------------------------------------------
-- One Strava account, one game account (story 3.3 AC 6)
--
-- The simplest exploit in the whole game, and the one an index closes for
-- good: two participants linking the same Strava account would share the
-- same activities, therefore the same completed challenges, therefore the
-- same points. No amount of application code is a substitute here — two
-- simultaneous authorisations would both pass a check and both write.
--
-- Partial, on live links only: an account genuinely unlinked must be free to
-- be linked again, by its owner or by somebody else who bought the watch.
-- -------------------------------------------------------------------------
create unique index activity_connections_one_game_account
  on public.activity_connections (provider, provider_account_id)
  where disconnected_at is null;

-- And one live link per participant per provider, for the same reason in the
-- other direction.
create unique index activity_connections_one_per_participant
  on public.activity_connections (profile_id, provider)
  where disconnected_at is null;

-- Which links are due a token refresh (story 3.7).
create index activity_connections_expiry_idx
  on public.activity_connections (expires_at)
  where disconnected_at is null and status = 'active';

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.activity_connections enable row level security;

-- **No policy at all — not even a read for the owner.** That is the whole
-- design, and it is the same trap the `public_profiles` view of story 1.6
-- was built to avoid: row level security filters ROWS, not COLUMNS. Letting
-- a participant read their own connection row would let them read their own
-- access token straight from the REST API — and a Strava access token opens
-- somebody's entire sporting history, private activities included.
--
-- The application reads this table server-side with the service key and
-- hands the screen only what is safe to show: connected or not, since when,
-- last synchronised when. The token never crosses to a browser.
