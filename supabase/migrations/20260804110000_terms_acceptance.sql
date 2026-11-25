-- =========================================================================
-- DEFI Movember — recording the acceptance of terms (story 2.2)
--
-- The participant ticks two boxes before paying: the terms of sale, and the
-- notice that this is not a tax-deductible donation (FR14, PRD D6). What is
-- recorded here is that they did.
--
-- The version matters as much as the date. The terms published in story 1.9
-- are a working draft and will be rewritten before registration opens;
-- knowing *when* someone accepted says nothing about *what* they accepted.
-- Without the version, the acceptance proves nothing.
-- =========================================================================

alter table public.registrations
  add column terms_accepted_at timestamptz,
  add column terms_version text;

comment on column public.registrations.terms_version is
  'Version of the terms accepted. The date alone proves nothing — the text changes.';

-- Both together or neither. A date without a version is a record that cannot
-- be used, and a version without a date is not an acceptance.
alter table public.registrations
  add constraint registrations_terms_are_complete
  check (
    (terms_accepted_at is null and terms_version is null)
    or (terms_accepted_at is not null and terms_version is not null)
  );
