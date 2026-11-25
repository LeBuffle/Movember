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


-- -------------------------------------------------------------------------
-- The three registration tiers (story 2.1)
--
-- Provisional amounts, and knowingly so: what tiers 2 and 3 hand over
-- depends on the medal and booster costs, which are not settled. They live
-- here rather than in the code precisely so that changing them takes a SQL
-- statement and not a deployment.
--
-- What must NOT be written anywhere, in the database or in the interface, is
-- "100 %". On the first tier, 12 € paid leaves about 11,57 € after the
-- payment processor's fee. "12 € reversés" states the association's
-- commitment and stays true whoever absorbs the fee — which is decision P2,
-- still open.
--
-- Safe to re-run.
-- -------------------------------------------------------------------------

insert into public.registration_tiers (
  edition_id, slug, name, tagline, price_cents, donated_cents, perks, position,
  requires_shipping
)
select
  e.id, v.slug, v.name, v.tagline, v.price_cents, v.donated_cents, v.perks,
  v.position, v.requires_shipping
from public.editions e
cross join (values
  (
    'engage',
    'Sportif engagé',
    'Pour jouer, tout simplement.',
    1200, 1200,
    array[
      'Un défi sportif par jour pendant tout novembre',
      'Une carte offerte chaque jour, par tirage au sort',
      'Accès aux classements et aux équipes'
    ],
    1,
    -- Rien à poster : ce niveau se joue entièrement dans l'application.
    false
  ),
  (
    'chevronne',
    'Sportif chevronné',
    'Le jeu, et quelque chose à garder.',
    3000, 1800,
    array[
      'Tout le niveau Sportif engagé',
      'Une médaille premium envoyée à la fin du défi'
    ],
    2,
    true
  ),
  (
    'legendaire',
    'Sportif légendaire',
    'Pour les collectionneurs.',
    5000, 3500,
    array[
      'Tout le niveau Sportif chevronné',
      '2 packs de 5 cartes moustachues',
      'Une carte légendaire garantie'
    ],
    3,
    true
  )
) as v(slug, name, tagline, price_cents, donated_cents, perks, position,
       requires_shipping)
where e.year = 2026
on conflict (edition_id, slug) do nothing;

-- -------------------------------------------------------------------------
-- Les packs achetables (story 10.1)
--
-- **Les prix ci-dessous sont une proposition, pas une décision.** Le prix des
-- packs est la décision P3 du PRD, encore ouverte. C'est précisément pour
-- cela qu'ils vivent en base : les changer prend une instruction SQL, jamais
-- un déploiement.
--
-- Le montant versé est intégralement reversable — un pack n'expédie rien et
-- n'imprime rien — et la contrainte `card_packs_fully_donated` l'impose.
--
-- Rejouable sans risque.
-- -------------------------------------------------------------------------

insert into public.card_packs (
  edition_id, slug, name, tagline, price_cents, donated_cents, card_count,
  guaranteed_rarity, position
)
select
  e.id, v.slug, v.name, v.tagline, v.price_cents, v.donated_cents,
  v.card_count, v.guaranteed_rarity, v.position
from public.editions e
cross join (values
  (
    'moustache',
    'Pack Moustache',
    '5 cartes tirées au sort.',
    300, 300, 5,
    null,
    1
  ),
  (
    'guidon',
    'Pack Guidon',
    '5 cartes, dont une épique au minimum.',
    600, 600, 5,
    'epique',
    2
  )
) as v(slug, name, tagline, price_cents, donated_cents, card_count,
       guaranteed_rarity, position)
where e.year = 2026
on conflict (edition_id, slug) do nothing;


-- -------------------------------------------------------------------------
-- Les trois défis entre joueurs (epic 12)
--
-- Catalogue fixe, voulu fixe : un défi vise quelqu'un nommément, ce n'est
-- donc pas l'endroit d'un texte libre. Ce qui vit en base, c'est le seuil et
-- le délai — modifiables en une instruction SQL le 3 novembre.
--
-- `effort: single` et `window: day` : le défi se relève en une sortie, et la
-- vraie fenêtre temporelle — après l'envoi, dans les 24 h — est vérifiée à la
-- minute par l'application, pas par l'évaluateur.
--
-- Rejouable sans risque.
-- -------------------------------------------------------------------------

insert into public.duel_types (
  edition_id, slug, name, tagline, evaluator, config, hours, position
)
select e.id, v.slug, v.name, v.tagline, v.evaluator, v.config::jsonb, 24, v.position
from public.editions e
cross join (values
  (
    'course-2km',
    'Courir 2 km',
    'Une sortie de 2 km au minimum, à partir de maintenant.',
    'distance',
    '{"min_distance_meters": 2000, "sport_types": ["run"], "window": "day", "effort": "single"}',
    1
  ),
  (
    'velo-10km',
    'Rouler 10 km',
    'Une sortie de 10 km au minimum, à partir de maintenant.',
    'distance',
    '{"min_distance_meters": 10000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
    2
  ),
  (
    'activite',
    'Faire une activité',
    'N''importe quel sport, au moins dix minutes, à partir de maintenant.',
    'duration',
    '{"min_duration_seconds": 600, "sport_types": ["any"], "window": "day", "effort": "single"}',
    3
  )
) as v(slug, name, tagline, evaluator, config, position)
where e.year = 2026
on conflict (edition_id, slug) do nothing;


-- -------------------------------------------------------------------------
-- Les lots de crédits (décision P10)
--
-- Prix unitaire identique dans les deux lots : la remise n'est pas le sujet.
-- Le lot existe pour amortir les frais Stripe — 14 % sur un paiement de 2 €,
-- 3,9 % sur un lot à 10 €.
-- -------------------------------------------------------------------------

insert into public.duel_credit_lots (
  edition_id, slug, name, tagline, credits, price_cents, donated_cents, position
)
select e.id, v.slug, v.name, v.tagline, v.credits, v.price_cents, v.donated_cents, v.position
from public.editions e
cross join (values
  (
    'lot-5',
    '5 défis',
    'De quoi provoquer cinq collègues.',
    5, 1000, 1000,
    1
  ),
  (
    'lot-10',
    '10 défis',
    'Pour tenir tout le mois.',
    10, 2000, 2000,
    2
  )
) as v(slug, name, tagline, credits, price_cents, donated_cents, position)
where e.year = 2026
on conflict (edition_id, slug) do nothing;
