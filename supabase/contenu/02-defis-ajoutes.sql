-- =========================================================================
-- DEFI Movember — les 3 défis ajoutés à la main dans le back-office
--
-- Le catalogue `supabase/challenges-2026.sql` en contient 70 ; la base en
-- comptait 73. Voici les trois qui manquaient.
--
-- ⚠️ **Ils ressemblent à des doublons de recette.** « 100 km de vélo » et
-- « Vélo : 100 km » décrivent le même effort, de même pour les deux autres.
-- Ils ont très probablement été créés en essayant le formulaire du
-- back-office. Ils sont conservés ici pour ne rien perdre, pas parce qu'ils
-- doivent revenir : **à relire avant de lancer ce fichier**, et à ignorer
-- s'il s'agit bien de doublons.
--
-- À passer APRÈS `challenges-2026.sql`.
--
-- Rejouable sans risque : un défi déjà présent sous le même titre pour cette
-- édition n'est pas réinséré.
-- =========================================================================

insert into public.challenges (title, description, evaluator, config, sport_family, difficulty, points, duration_scope, duration_days, reward_rules, is_active, edition_id)
select '100 km de vélo', '', 'distance',
  '{"window": "multi_day", "sport_types": ["bike"], "min_distance_meters": 100000}'::jsonb,
  'bike', 'moyen', 30,
  'multi_day', 30,
  '{"draw": "random_weighted", "cards": 1}'::jsonb, true, e.id
from public.editions e where e.year = 2026
and not exists (select 1 from public.challenges c where c.title = '100 km de vélo' and c.edition_id = e.id);

insert into public.challenges (title, description, evaluator, config, sport_family, difficulty, points, duration_scope, duration_days, reward_rules, is_active, edition_id)
select '30 km de vélo', '', 'distance',
  '{"window": "day", "sport_types": ["bike"], "min_distance_meters": 30000}'::jsonb,
  'bike', 'moyen', 20,
  'day', null,
  '{"draw": "random_weighted", "cards": 1}'::jsonb, true, e.id
from public.editions e where e.year = 2026
and not exists (select 1 from public.challenges c where c.title = '30 km de vélo' and c.edition_id = e.id);

insert into public.challenges (title, description, evaluator, config, sport_family, difficulty, points, duration_scope, duration_days, reward_rules, is_active, edition_id)
select '5km de course dans la journée', '', 'distance',
  '{"window": "day", "sport_types": ["run"], "min_distance_meters": 5000}'::jsonb,
  'run', 'facile', 10,
  'day', null,
  '{"draw": "random_weighted", "cards": 1}'::jsonb, true, e.id
from public.editions e where e.year = 2026
and not exists (select 1 from public.challenges c where c.title = '5km de course dans la journée' and c.edition_id = e.id);

-- Contrôle : 70 avec le seul catalogue, 73 avec ce fichier.
select count(*) || ' défi(s) en base' as resultat from public.challenges;
