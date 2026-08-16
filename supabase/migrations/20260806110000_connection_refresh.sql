-- =========================================================================
-- DEFI Movember — refreshing provider tokens (story 3.7)
--
-- A Strava access token expires in a few hours. On a thirty-day game, a link
-- that does not refresh itself is a link that dies the first evening — so
-- this is what turns story 3.3 from a demonstration into a mechanism.
-- =========================================================================

-- Who is currently refreshing this link, and since when.
--
-- **This exists because Strava rotates the refresh token.** Every successful
-- refresh returns a new one and invalidates the old. Two refreshes launched
-- at the same instant — the hourly task and a webhook landing together on
-- the same account — would each present the same old token: the second one
-- is refused, and the connection breaks with nobody having done anything
-- wrong.
--
-- A claim taken before calling the provider is what serialises them. Held as
-- a timestamp rather than a boolean so that a claim abandoned mid-flight —
-- the container restarted, the request timed out — expires on its own instead
-- of freezing the link for good.
alter table public.activity_connections
  add column if not exists refreshing_at timestamptz;

comment on column public.activity_connections.refreshing_at is
  'Claim taken before calling the provider, so two simultaneous refreshes cannot invalidate each other. Expires on its own.';

-- When the link broke, and it is not the same fact as `status`.
--
-- `status` says where things stand now; this says since when. "Broken since
-- the 4th" and "broken since ten minutes ago" call for different answers
-- from whoever is looking, and one of them is not an incident.
alter table public.activity_connections
  add column if not exists broken_at timestamptz;

comment on column public.activity_connections.broken_at is
  'When the provider refused the refresh token. Distinct from status, which only says where things stand now.';

-- What the hourly task looks for: live links whose token is about to expire.
-- The previous index covered `expires_at` alone; this one drops the rows
-- already being refreshed, which is most of them during a run.
create index if not exists activity_connections_refreshable_idx
  on public.activity_connections (expires_at)
  where disconnected_at is null and status = 'active' and refreshing_at is null;

-- No new access rule. `activity_connections` still carries no policy at all,
-- for anyone: refreshing happens server-side with the service key, and a
-- refresh token is the one thing that must never reach a browser.
