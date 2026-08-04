-- =========================================================================
-- DEFI Movember — demonstration data
--
-- Creates the 2026 edition so the application has something to display
-- before any real content exists. Safe to re-run.
--
-- Deliberately contains NO user account: accounts are created through the
-- signup flow, which is what fires the profile trigger. Inserting one here
-- would produce a profile the real flow never creates, and hide a bug.
-- =========================================================================


-- -------------------------------------------------------------------------
-- Creating an administrator (story 1.10, AC 8)
--
-- Two steps, and the first one cannot be skipped:
--
--   1. Sign up through the application, at /inscription, and confirm the
--      e-mail. This is what creates the row in `profiles`.
--   2. Run the statement below with that address.
--
-- Why not create the account here. An account lives in Supabase's own
-- `auth.users`, whose columns are internal and change between versions.
-- Writing into it from a seed would mean shipping a known password in the
-- repository and bypassing the trigger that fills `profiles` — the very
-- trigger a demonstration data set should be exercising. The two-step
-- procedure is slower once and correct always.
--
-- Uncomment, replace the address, run:
--
--   update public.profiles
--      set role = 'admin'
--    where email = 'votre@email.fr';
--
-- To check who is an administrator:
--
--   select display_name, email from public.profiles where role = 'admin';
--
-- To take the role back:
--
--   update public.profiles
--      set role = 'participant'
--    where email = 'votre@email.fr';
-- -------------------------------------------------------------------------

insert into public.editions (
  year,
  name,
  registration_opens_on,
  starts_on,
  ends_on,
  status,
  collective_goals
)
values (
  2026,
  'DEFI Movember 2026',
  '2026-10-15',
  '2026-11-01',
  '2026-11-30',
  'draft',
  -- Targets set from the fourth edition's real figures: 400 participants,
  -- 5 000 €, 30 000 km, 3 500 hours.
  '{"kilometres": 50000, "hours": 6000, "amount_cents": 1000000}'::jsonb
)
on conflict (year) do nothing;
