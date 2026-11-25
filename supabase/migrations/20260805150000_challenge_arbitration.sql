-- =========================================================================
-- DEFI Movember — manual arbitration of a challenge (story 4.10)
--
-- The relief valve of the whole engine. An evaluator that is too strict, an
-- activity that synced badly, a watch that cut out mid-run: somebody has to
-- be able to decide, in November, without waiting for a fix to be written
-- and deployed. Without this, every edge case becomes a development
-- emergency in the middle of the month.
--
-- Two columns, and no more. The *current state* lives on the row; the
-- *history* — who, when, why, and what it was before — lives in
-- `admin_audit_log`, which nobody can edit or delete. Copying the reason
-- onto the row as well would give two records of the same fact that can
-- drift apart, and the one on the row would be the one that loses its
-- history at the first correction.
-- =========================================================================

alter table public.challenge_assignments
  add column if not exists arbitrated_at timestamptz;

alter table public.challenge_assignments
  add column if not exists arbitrated_by uuid
    references public.profiles (id) on delete set null;

comment on column public.challenge_assignments.arbitrated_at is
  'When an administrator decided this challenge by hand. The reason and the previous state are in admin_audit_log.';

comment on column public.challenge_assignments.arbitrated_by is
  'Who decided. Kept null on account deletion: the audit log keeps the trace, this column is only for display.';

-- Marked as arbitrated on both sides — participant and back-office
-- (story 4.10 AC 4). This index serves the back-office side: "what has been
-- decided by hand this month" has to be answerable in one glance, because it
-- is the first question asked when a leaderboard is contested.
create index challenge_assignments_arbitrated_idx
  on public.challenge_assignments (edition_id, arbitrated_at desc)
  where arbitrated_at is not null;

-- No new access rule, and that is the point.
--
-- `challenge_assignments` still has no write policy for anyone (story 4.1).
-- Arbitration goes through the server with the service key, after the role
-- has been checked and after the trace has been written. A participant able
-- to set `arbitrated_at` on their own row would be a participant able to
-- award themselves the month and make it look official.
--
-- Participants do read the column — they read their own assignments — and
-- that is deliberate: a challenge decided by hand says so on their screen.
