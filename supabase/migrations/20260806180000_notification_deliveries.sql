-- =========================================================================
-- DEFI Movember — what has already been sent (story 6.3)
--
-- The table that makes a send replayable. Everything in this project that
-- runs on a schedule can run twice: a cron that overlaps, a task relaunched
-- by hand because the morning looked wrong, a deployment mid-run. For a
-- database write that is harmless — the writes are idempotent. For a
-- notification it is not: a notification sent is sent, and the second one
-- cannot be taken back.
-- =========================================================================

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- **This is the whole point of the table.** Built by the caller from what
  -- makes the send unique — `defi-du-jour:2026-11-03`, `annonce:<id>` — so
  -- that relaunching the same task finds the row and sends nothing.
  dedupe_key text not null,

  -- Which category, for the preferences of story 6.7 and for the report.
  category text not null,

  -- Which way it actually went out. A participant gets one or the other,
  -- never both (story 6.4 AC 3), so this records the choice rather than
  -- multiplying the rows.
  channel text not null check (channel in ('push', 'email', 'none')),

  sent_at timestamptz not null default now()
);

comment on table public.notification_deliveries is
  'One line per participant per send. The unique key is what makes relaunching a send harmless (story 6.3 AC 5).';

comment on column public.notification_deliveries.channel is
  'none records a participant deliberately skipped — no device and no e-mail, or a preference. Recorded so a report can distinguish "skipped" from "failed".';

-- The guard, carried by the database rather than by a check in the code.
--
-- Two overlapping runs both read "not yet sent" and both send; only an index
-- refuses. The insert therefore comes BEFORE the send, and a unique violation
-- is read as "somebody else got there first".
create unique index notification_deliveries_once
  on public.notification_deliveries (profile_id, dedupe_key);

create index notification_deliveries_recent_idx
  on public.notification_deliveries (sent_at desc);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.notification_deliveries enable row level security;

-- Admins only. A participant has no use for this — what they received is
-- what appeared on their phone — and it is the sending log of the whole
-- edition.
create policy "admins read the delivery log"
  on public.notification_deliveries for select
  to authenticated
  using ((select public.is_admin()));

-- No write policy, for anybody. Sending is a server operation; a row here is
-- what proves a notification was not sent twice, and a row somebody can write
-- proves nothing.
