-- =========================================================================
-- DEFI Movember — demonstration data
--
-- Creates the 2026 edition so the application has something to display
-- before any real content exists. Safe to re-run.
--
-- Deliberately contains NO user account: accounts are created through the
-- signup flow, which is what fires the profile trigger. Inserting one here
-- would produce a profile the real flow never creates, and hide a bug.
--
-- To promote yourself to admin, sign up through the app first, then:
--   update public.profiles set role = 'admin' where email = 'votre@email.fr';
-- =========================================================================

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
