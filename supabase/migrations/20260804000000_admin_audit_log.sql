-- =========================================================================
-- DEFI Movember — administrative audit log (story 1.10)
--
-- Records what the organising team does in the back-office. Nothing writes
-- to it yet: the screens arrive with epics 4, 5, 6 and 9. The table exists
-- now so that each of those epics finds it ready instead of inventing its
-- own, and so the access rules are decided once, calmly, rather than in the
-- middle of a feature.
--
-- What it is for: a volunteer association handling other people's money and
-- other people's sports data. When someone asks in December why a challenge
-- was cancelled or a participant refunded, the answer has to exist.
-- =========================================================================

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),

  -- `restrict` rather than `set null` or `cascade`: a journal that is erased
  -- by deleting the account that wrote it is not a journal. The account
  -- deletion flow (story 11.2) anonymises profiles rather than dropping the
  -- row, so this constraint never actually blocks a participant's erasure
  -- request — it blocks a hard delete, which is exactly what it is for.
  admin_id uuid not null references public.profiles (id) on delete restrict,

  -- Free-form verb, e.g. 'challenge.published', 'payment.refunded'. Not an
  -- enum: every epic adds its own actions, and a migration per new verb
  -- would guarantee the logging gets skipped.
  action text not null check (length(action) between 1 and 100),

  -- What was acted on. Both nullable: some actions target nothing in
  -- particular ('edition.opened').
  target_table text,
  target_id uuid,

  -- Whatever context the action needs. Deliberately loose, and deliberately
  -- NOT a place for personal data: an audit entry outlives the account it
  -- refers to, so copying an e-mail address in here would survive that
  -- person's erasure request.
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Administrative action log. Append-only: no update or delete policy exists, on purpose.';

comment on column public.admin_audit_log.payload is
  'Context of the action. Never personal data — an entry outlives the account it refers to.';

-- The back-office reads this newest-first, and filters by admin when
-- answering "who did that?".
create index admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index admin_audit_log_admin_id_idx
  on public.admin_audit_log (admin_id, created_at desc);

-- -------------------------------------------------------------------------
-- Access rules
-- -------------------------------------------------------------------------

alter table public.admin_audit_log enable row level security;

-- Reading is for admins only. A participant must not be able to learn what
-- the organising team is preparing — challenge catalogues and card drops
-- lose their point if they can be read in advance.
create policy "admins read the audit log"
  on public.admin_audit_log for select
  to authenticated
  using ((select public.is_admin()));

-- Writing is for admins, and only under their own name. `admin_id =
-- auth.uid()` is the part that matters: without it, an admin could file an
-- entry attributed to someone else, and the journal would be worth nothing
-- the day it is needed.
--
-- Enforced here rather than in the application so that it holds whatever
-- calls the database — a page, a script, a future job.
create policy "admins write under their own name"
  on public.admin_audit_log for insert
  to authenticated
  with check (
    (select public.is_admin())
    and admin_id = (select auth.uid())
  );

-- No update policy and no delete policy, and that is the whole design. An
-- append-only journal cannot be quietly corrected after the fact — including
-- by an administrator. Should an entry ever need removing (a mistaken
-- payload carrying personal data, say), it takes a deliberate migration,
-- which leaves its own trace in the repository.
