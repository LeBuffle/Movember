-- =========================================================================
-- DEFI Movember — catalogue de défis, édition 2026
--
-- 70 défis, à passer dans l'éditeur SQL de Supabase après les migrations.
--
-- **Rejouable sans risque.** Chaque défi n'est inséré que s'il n'existe pas
-- déjà sous le même titre pour cette édition. Relancer le fichier après en
-- avoir ajouté trois n'insère que les trois.
--
-- **Rien ici n'est définitif.** Un seuil se change en une instruction SQL, un
-- défi se retire du tirage avec `is_active = false` — jamais avec un DELETE,
-- qui emporterait les attributions et les résultats qui le référencent.
--
-- ---------------------------------------------------------------------
-- Comment lire une ligne
--
--   sport_family   à qui le défi peut être attribué. `any` = tout le monde.
--                  Les autres ne partent qu'aux participants dont Strava
--                  montre ce sport (story 4.4).
--   difficulty     l'étiquette affichée. N'influence pas le tirage.
--   points         ce que le défi rapporte au classement général.
--   duration_scope 'day' = à faire dans la journée. 'multi_day' = fil rouge.
--   config         les paramètres que le moteur évalue.
--
-- **Un fil rouge est rétroactif : il regarde le mois, pas le tirage.** Tiré le
-- 28 novembre, « 20 jours d'activité » est validé par vingt journées déjà
-- faites — ce qu'il mesure est une habitude, et l'habitude n'a pas commencé le
-- matin du tirage. Deux bornes tiennent la règle : la fenêtre ne remonte
-- jamais avant le 1er novembre, et jamais au-delà de la sortie évaluée.
--
-- Conséquence directe : aucun fil rouge n'est un piège en fin de mois, et il
-- n'y a rien à désactiver le 20 novembre.
--
-- **Les points sont proportionnels à l'effort, pas à la difficulté
-- ressentie.** C'est ce qui rend le tirage supportable : recevoir un 30 km
-- plutôt qu'un 5 km n'est pas une malchance, c'est cinq fois plus d'effort
-- pour cinq fois plus de points.
--
-- ---------------------------------------------------------------------
-- Répartition
--
--   Tous sports .............. 22   dont 7 fils rouges
--   Course à pied ............ 16
--   Vélo ..................... 14
--   Marche ...................  7
--   Renforcement ............   6
--   Natation .................  5
--                              ---
--                               70
--
-- **Les 22 « tous sports » ne sont pas un remplissage.** Un participant dont
-- l'historique Strava ne dit encore rien ne peut recevoir QUE ces défis-là
-- (architecture D13). C'est le cas de tout nouvel inscrit les premiers jours :
-- ce bloc est leur catalogue entier, et c'est pour cela qu'il est le plus gros.
-- =========================================================================

insert into public.challenges (
  edition_id, title, description, evaluator, config,
  sport_family, difficulty, points, duration_scope, duration_days
)
select
  e.id, v.title, v.description, v.evaluator, v.config::jsonb,
  v.sport_family, v.difficulty, v.points, v.duration_scope, v.duration_days
from public.editions e
cross join (values

-- -------------------------------------------------------------------------
-- TOUS SPORTS — 22
--
-- Le socle. Ils vont à tout le monde, quel que soit le sport pratiqué, et ils
-- sont la seule chose qu'un nouvel inscrit peut recevoir.
-- -------------------------------------------------------------------------

-- Ponctuels : la porte d'entrée du jeu. Six paliers de durée, du quart
-- d'heure au bloc de deux heures.
('Bouger 20 minutes',
 'N’importe quelle activité enregistrée, 20 minutes suffisent.',
 'duration', '{"min_duration_seconds": 1200, "sport_types": ["any"], "window": "day", "effort": "single"}',
 'any', 'facile', 8, 'day', null),

('Bouger 30 minutes',
 'Une demi-heure d’activité dans la journée. Le sport, c’est vous qui voyez.',
 'duration', '{"min_duration_seconds": 1800, "sport_types": ["any"], "window": "day", "effort": "single"}',
 'any', 'facile', 10, 'day', null),

('Bouger 45 minutes',
 'Trois quarts d’heure, d’un seul tenant.',
 'duration', '{"min_duration_seconds": 2700, "sport_types": ["any"], "window": "day", "effort": "single"}',
 'any', 'moyen', 16, 'day', null),

('Bouger 1 heure',
 'Une heure d’activité. Marche, course, vélo, piscine, salle : au choix.',
 'duration', '{"min_duration_seconds": 3600, "sport_types": ["any"], "window": "day", "effort": "single"}',
 'any', 'moyen', 20, 'day', null),

('Bouger 1 h 30',
 'Une heure et demie dans la journée, en une seule sortie.',
 'duration', '{"min_duration_seconds": 5400, "sport_types": ["any"], "window": "day", "effort": "single"}',
 'any', 'moyen', 28, 'day', null),

('Bouger 2 heures',
 'Deux heures d’un coup. La grosse sortie du dimanche.',
 'duration', '{"min_duration_seconds": 7200, "sport_types": ["any"], "window": "day", "effort": "single"}',
 'any', 'difficile', 36, 'day', null),

-- Cumulés : la même chose, mais étalée. C'est ce qui rend le jeu tenable
-- pour quelqu'un qui a une vie.
('3 heures d’activité en 7 jours',
 'Toutes vos sorties de la semaine s’additionnent.',
 'duration', '{"min_duration_seconds": 10800, "sport_types": ["any"], "window": "multi_day", "effort": "cumulative"}',
 'any', 'moyen', 45, 'multi_day', 7),

('5 heures d’activité en 10 jours',
 'Une demi-heure par jour en moyenne. Tout compte.',
 'duration', '{"min_duration_seconds": 18000, "sport_types": ["any"], "window": "multi_day", "effort": "cumulative"}',
 'any', 'moyen', 65, 'multi_day', 10),

('10 heures d’activité en 20 jours',
 'Le gros morceau du mois. Toutes sorties confondues, y compris celles déjà faites.',
 'duration', '{"min_duration_seconds": 36000, "sport_types": ["any"], "window": "multi_day", "effort": "cumulative"}',
 'any', 'difficile', 110, 'multi_day', 20),

-- Multi-sports : de quoi sortir de sa routine sans en faire plus.
('Deux sports dans la journée',
 'Deux disciplines différentes, le même jour.',
 'multisport', '{"distinct_sports": 2, "sport_types": ["any"], "window_days": 1}',
 'any', 'moyen', 30, 'day', null),

('Trois sports en 3 jours',
 'Trois disciplines différentes en trois jours. La variété plutôt que le volume.',
 'multisport', '{"distinct_sports": 3, "sport_types": ["any"], "window_days": 3}',
 'any', 'moyen', 40, 'multi_day', 3),

('Trois sports en 7 jours',
 'Trois disciplines différentes dans la semaine.',
 'multisport', '{"distinct_sports": 3, "sport_types": ["any"], "window_days": 7}',
 'any', 'moyen', 50, 'multi_day', 7),

('Quatre sports en 14 jours',
 'Quatre disciplines différentes en deux semaines. Le défi des touche-à-tout.',
 'multisport', '{"distinct_sports": 4, "sport_types": ["any"], "window_days": 14}',
 'any', 'difficile', 85, 'multi_day', 14),

-- Fils rouges : la régularité. Sept paliers, du week-end prolongé au mois
-- presque complet. La tolérance est ce qui les rend humains — une série sans
-- tolérance s’arrête au troisième jour pour la plupart des gens, et cesse
-- alors de motiver qui que ce soit.
--
-- Rétroactifs, comme tous les défis sur plusieurs jours : les journées déjà
-- faites comptent.
('Fil rouge : 3 jours d’affilée',
 '20 minutes d’activité par jour, trois jours de suite.',
 'streak', '{"days": 3, "sport_types": ["any"], "allowed_gaps": 0, "min_duration_seconds_per_day": 1200}',
 'any', 'facile', 30, 'multi_day', 3),

('Fil rouge : 5 jours d’affilée',
 '20 minutes par jour, cinq jours de suite. Sans coupure.',
 'streak', '{"days": 5, "sport_types": ["any"], "allowed_gaps": 0, "min_duration_seconds_per_day": 1200}',
 'any', 'moyen', 45, 'multi_day', 5),

('Fil rouge : 5 jours sur 7',
 'Cinq journées actives dans la semaine. Deux jours de repos autorisés.',
 'streak', '{"days": 7, "sport_types": ["any"], "allowed_gaps": 2, "min_duration_seconds_per_day": 1200}',
 'any', 'moyen', 50, 'multi_day', 7),

('Fil rouge : 7 jours d’affilée',
 'Une semaine complète sans un jour sans rien.',
 'streak', '{"days": 7, "sport_types": ["any"], "allowed_gaps": 0, "min_duration_seconds_per_day": 1200}',
 'any', 'moyen', 60, 'multi_day', 7),

('Fil rouge : 8 jours sur 10',
 'Huit journées actives sur dix. Deux jours pour souffler.',
 'streak', '{"days": 10, "sport_types": ["any"], "allowed_gaps": 2, "min_duration_seconds_per_day": 1200}',
 'any', 'moyen', 70, 'multi_day', 10),

('Fil rouge : 10 jours d’affilée',
 'Dix jours de suite, sans en manquer un seul.',
 'streak', '{"days": 10, "sport_types": ["any"], "allowed_gaps": 0, "min_duration_seconds_per_day": 1200}',
 'any', 'difficile', 80, 'multi_day', 10),

('Fil rouge : 12 jours sur 15',
 'Douze journées actives sur quinze. Trois jours de tolérance.',
 'streak', '{"days": 15, "sport_types": ["any"], "allowed_gaps": 3, "min_duration_seconds_per_day": 1200}',
 'any', 'difficile', 95, 'multi_day', 15),

('Fil rouge : 20 jours sur 25',
 'Vingt journées actives en vingt-cinq jours. Les journées déjà faites comptent.',
 'streak', '{"days": 25, "sport_types": ["any"], "allowed_gaps": 5, "min_duration_seconds_per_day": 1200}',
 'any', 'difficile', 130, 'multi_day', 25),

-- Un défi « au choix » : la même exigence exprimée dans deux disciplines, et
-- une seule suffit. Utile pour ceux qui alternent selon la météo.
('Au choix : 10 km de course ou 30 km de vélo',
 'L’un ou l’autre dans la journée. À vous de voir ce que dit le ciel.',
 'surprise', '{"mode": "any", "conditions": [{"evaluator": "distance", "config": {"min_distance_meters": 10000, "sport_types": ["run"], "window": "day", "effort": "single"}}, {"evaluator": "distance", "config": {"min_distance_meters": 30000, "sport_types": ["bike"], "window": "day", "effort": "single"}}]}',
 'any', 'moyen', 30, 'day', null),

-- -------------------------------------------------------------------------
-- COURSE À PIED — 16
--
-- Neuf paliers de distance, de 3 à 30 km. Les points suivent la distance, ce
-- qui fait qu’un 30 km rapporte cinq fois un 5 km — parce que c’est cinq fois
-- l’effort, pas parce que c’est cinq fois plus méritant.
-- -------------------------------------------------------------------------

('Course : 3 km',
 'Trois kilomètres. Le premier palier, et le plus important.',
 'distance', '{"min_distance_meters": 3000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'facile', 10, 'day', null),

('Course : 5 km',
 'Cinq kilomètres en une seule sortie.',
 'distance', '{"min_distance_meters": 5000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'facile', 12, 'day', null),

('Course : 7 km',
 'Sept kilomètres d’un coup.',
 'distance', '{"min_distance_meters": 7000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'moyen', 16, 'day', null),

('Course : 10 km',
 'Le dix kilomètres. La distance de référence.',
 'distance', '{"min_distance_meters": 10000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'moyen', 22, 'day', null),

('Course : 12 km',
 'Douze kilomètres en une fois.',
 'distance', '{"min_distance_meters": 12000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'moyen', 26, 'day', null),

('Course : 15 km',
 'Quinze kilomètres. On commence à parler de sortie longue.',
 'distance', '{"min_distance_meters": 15000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'difficile', 32, 'day', null),

('Course : 20 km',
 'Vingt kilomètres d’un seul tenant.',
 'distance', '{"min_distance_meters": 20000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'difficile', 42, 'day', null),

('Course : 25 km',
 'Vingt-cinq kilomètres. Une vraie sortie longue.',
 'distance', '{"min_distance_meters": 25000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'difficile', 52, 'day', null),

('Course : 30 km',
 'Trente kilomètres en une fois. Le plus dur du catalogue en course.',
 'distance', '{"min_distance_meters": 30000, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'difficile', 62, 'day', null),

('Course : 30 minutes',
 'Une demi-heure de course, peu importe la distance parcourue.',
 'duration', '{"min_duration_seconds": 1800, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'facile', 12, 'day', null),

('Course : 1 heure',
 'Soixante minutes de course. Le temps compte, pas le rythme.',
 'duration', '{"min_duration_seconds": 3600, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'moyen', 24, 'day', null),

('Course : 20 km cumulés en 5 jours',
 'Quatre kilomètres par jour en moyenne, à répartir comme vous voulez.',
 'distance', '{"min_distance_meters": 20000, "sport_types": ["run"], "window": "multi_day", "effort": "cumulative"}',
 'run', 'moyen', 40, 'multi_day', 5),

('Course : 30 km cumulés en 7 jours',
 'Toutes vos sorties de la semaine s’additionnent.',
 'distance', '{"min_distance_meters": 30000, "sport_types": ["run"], "window": "multi_day", "effort": "cumulative"}',
 'run', 'moyen', 55, 'multi_day', 7),

('Course : 52 km cumulés en 14 jours',
 'Un kilomètre par semaine de l’année, en deux semaines.',
 'distance', '{"min_distance_meters": 52000, "sport_types": ["run"], "window": "multi_day", "effort": "cumulative"}',
 'run', 'difficile', 100, 'multi_day', 14),

('Course : 80 km cumulés en 20 jours',
 'Quatre kilomètres par jour en moyenne, sur vingt jours.',
 'distance', '{"min_distance_meters": 80000, "sport_types": ["run"], "window": "multi_day", "effort": "cumulative"}',
 'run', 'difficile', 130, 'multi_day', 20),

('Course : 300 m de dénivelé',
 'Trois cents mètres de montée cumulés dans une sortie. Le plat ne compte pas.',
 'elevation', '{"min_elevation_meters": 300, "sport_types": ["run"], "window": "day", "effort": "single"}',
 'run', 'difficile', 40, 'day', null),

-- -------------------------------------------------------------------------
-- VÉLO — 14
--
-- Les distances demandées par le PO, et les paliers intermédiaires qui les
-- rendent atteignables. Le vélo avale les kilomètres : les seuils sont trois
-- fois ceux de la course pour un effort comparable.
-- -------------------------------------------------------------------------

('Vélo : 15 km',
 'Quinze kilomètres. Un aller-retour au travail suffit souvent.',
 'distance', '{"min_distance_meters": 15000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'facile', 10, 'day', null),

('Vélo : 30 km',
 'Trente kilomètres en une sortie.',
 'distance', '{"min_distance_meters": 30000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'moyen', 18, 'day', null),

('Vélo : 50 km',
 'Cinquante kilomètres d’un coup.',
 'distance', '{"min_distance_meters": 50000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'moyen', 28, 'day', null),

('Vélo : 70 km',
 'Soixante-dix kilomètres. La sortie du week-end.',
 'distance', '{"min_distance_meters": 70000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'difficile', 40, 'day', null),

('Vélo : 100 km',
 'Le centaine. Cent kilomètres en une seule sortie.',
 'distance', '{"min_distance_meters": 100000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'difficile', 58, 'day', null),

('Vélo : 1 heure',
 'Une heure de vélo, peu importe la distance.',
 'duration', '{"min_duration_seconds": 3600, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'facile', 14, 'day', null),

('Vélo : 2 heures',
 'Deux heures en selle, d’un seul tenant.',
 'duration', '{"min_duration_seconds": 7200, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'moyen', 26, 'day', null),

('Vélo : 100 km cumulés en 7 jours',
 'Toutes vos sorties de la semaine s’additionnent. Les trajets aussi.',
 'distance', '{"min_distance_meters": 100000, "sport_types": ["bike"], "window": "multi_day", "effort": "cumulative"}',
 'bike', 'moyen', 45, 'multi_day', 7),

('Vélo : 150 km cumulés en 10 jours',
 'Quinze kilomètres par jour en moyenne, à votre rythme.',
 'distance', '{"min_distance_meters": 150000, "sport_types": ["bike"], "window": "multi_day", "effort": "cumulative"}',
 'bike', 'moyen', 60, 'multi_day', 10),

('Vélo : 300 km cumulés en 15 jours',
 'Vingt kilomètres par jour en moyenne, sur quinze jours.',
 'distance', '{"min_distance_meters": 300000, "sport_types": ["bike"], "window": "multi_day", "effort": "cumulative"}',
 'bike', 'difficile', 95, 'multi_day', 15),

('Vélo : 500 km cumulés en 25 jours',
 'Le grand rouleur du mois. Les kilomètres déjà parcourus comptent.',
 'distance', '{"min_distance_meters": 500000, "sport_types": ["bike"], "window": "multi_day", "effort": "cumulative"}',
 'bike', 'difficile', 140, 'multi_day', 25),

('Vélo : 500 m de dénivelé',
 'Cinq cents mètres de montée dans une sortie.',
 'elevation', '{"min_elevation_meters": 500, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'moyen', 30, 'day', null),

('Vélo : 1 000 m de dénivelé',
 'Mille mètres de montée en une sortie. Les jambes s’en souviendront.',
 'elevation', '{"min_elevation_meters": 1000, "sport_types": ["bike"], "window": "day", "effort": "single"}',
 'bike', 'difficile', 45, 'day', null),

('Vélo : 2 000 m de dénivelé en 10 jours',
 'Deux mille mètres de montée cumulés sur dix jours.',
 'elevation', '{"min_elevation_meters": 2000, "sport_types": ["bike"], "window": "multi_day", "effort": "cumulative"}',
 'bike', 'difficile', 75, 'multi_day', 10),

-- -------------------------------------------------------------------------
-- MARCHE — 7
--
-- **Le bloc qui décide si le jeu est ouvert ou réservé aux sportifs.** Sans
-- lui, un collègue qui ne court pas et ne roule pas n’a que les défis « tous
-- sports » — et le mois lui paraîtra vite étranger.
-- -------------------------------------------------------------------------

('Marche : 5 km',
 'Cinq kilomètres à pied. Une heure de balade suffit.',
 'distance', '{"min_distance_meters": 5000, "sport_types": ["walk"], "window": "day", "effort": "single"}',
 'walk', 'facile', 8, 'day', null),

('Marche : 10 km',
 'Dix kilomètres de marche dans la journée.',
 'distance', '{"min_distance_meters": 10000, "sport_types": ["walk"], "window": "day", "effort": "single"}',
 'walk', 'moyen', 16, 'day', null),

('Marche : 15 km',
 'Quinze kilomètres à pied. Une vraie randonnée.',
 'distance', '{"min_distance_meters": 15000, "sport_types": ["walk"], "window": "day", "effort": "single"}',
 'walk', 'difficile', 26, 'day', null),

('Marche : 1 heure',
 'Une heure de marche enregistrée. La plus accessible du catalogue.',
 'duration', '{"min_duration_seconds": 3600, "sport_types": ["walk"], "window": "day", "effort": "single"}',
 'walk', 'facile', 10, 'day', null),

('Marche : 30 km cumulés en 7 jours',
 'Toutes vos marches de la semaine s’additionnent.',
 'distance', '{"min_distance_meters": 30000, "sport_types": ["walk"], "window": "multi_day", "effort": "cumulative"}',
 'walk', 'moyen', 40, 'multi_day', 7),

('Marche : 3 jours de suite',
 'Trente minutes de marche, trois jours d’affilée.',
 'streak', '{"days": 3, "sport_types": ["walk"], "allowed_gaps": 0, "min_duration_seconds_per_day": 1800}',
 'walk', 'moyen', 35, 'multi_day', 3),

('Marche : 300 m de dénivelé',
 'Trois cents mètres de montée à pied. Une bonne côte, ou une petite rando.',
 'elevation', '{"min_elevation_meters": 300, "sport_types": ["walk"], "window": "day", "effort": "single"}',
 'walk', 'moyen', 22, 'day', null),

-- -------------------------------------------------------------------------
-- RENFORCEMENT MUSCULAIRE — 6
--
-- ⚠️ Strava classe ici « Musculation », « Entraînement » et « Crossfit ». Le
-- yoga et le pilates n’y sont PAS rattachés : ils arrivent sans famille et ne
-- valident donc que les défis « tous sports ». À dire aux participants.
--
-- Pas de distance ici : une séance de salle n’en produit pas. Durée et
-- régularité uniquement.
-- -------------------------------------------------------------------------

('Renforcement : 20 minutes',
 'Vingt minutes de musculation, de renfo ou de crossfit.',
 'duration', '{"min_duration_seconds": 1200, "sport_types": ["strength"], "window": "day", "effort": "single"}',
 'strength', 'facile', 10, 'day', null),

('Renforcement : 45 minutes',
 'Trois quarts d’heure de séance.',
 'duration', '{"min_duration_seconds": 2700, "sport_types": ["strength"], "window": "day", "effort": "single"}',
 'strength', 'moyen', 20, 'day', null),

('Renforcement : 1 heure',
 'Une heure complète de renforcement.',
 'duration', '{"min_duration_seconds": 3600, "sport_types": ["strength"], "window": "day", "effort": "single"}',
 'strength', 'moyen', 26, 'day', null),

('Renforcement : 3 séances en 7 jours',
 'Trois séances d’au moins vingt minutes dans la semaine.',
 'streak', '{"days": 7, "sport_types": ["strength"], "allowed_gaps": 4, "min_duration_seconds_per_day": 1200}',
 'strength', 'moyen', 40, 'multi_day', 7),

('Renforcement : 5 séances en 10 jours',
 'Cinq séances d’au moins vingt minutes en dix jours. La régularité plutôt que l’exploit.',
 'streak', '{"days": 10, "sport_types": ["strength"], "allowed_gaps": 5, "min_duration_seconds_per_day": 1200}',
 'strength', 'difficile', 65, 'multi_day', 10),

('Renforcement : 3 heures cumulées en 10 jours',
 'Toutes vos séances de dix jours s’additionnent.',
 'duration', '{"min_duration_seconds": 10800, "sport_types": ["strength"], "window": "multi_day", "effort": "cumulative"}',
 'strength', 'difficile', 60, 'multi_day', 10),

-- -------------------------------------------------------------------------
-- NATATION — 5
--
-- Le plus petit bloc, et c’est assumé : peu de participants nagent, et le
-- tirage ne propose un défi natation qu’à ceux dont Strava en montre.
-- -------------------------------------------------------------------------

('Natation : 500 m',
 'Cinq cents mètres dans le bassin. Vingt longueurs de 25 m.',
 'distance', '{"min_distance_meters": 500, "sport_types": ["swim"], "window": "day", "effort": "single"}',
 'swim', 'facile', 12, 'day', null),

('Natation : 1 km',
 'Mille mètres en une séance.',
 'distance', '{"min_distance_meters": 1000, "sport_types": ["swim"], "window": "day", "effort": "single"}',
 'swim', 'moyen', 24, 'day', null),

('Natation : 1,5 km',
 'Mille cinq cents mètres. La distance du triathlon format S.',
 'distance', '{"min_distance_meters": 1500, "sport_types": ["swim"], "window": "day", "effort": "single"}',
 'swim', 'difficile', 34, 'day', null),

('Natation : 30 minutes',
 'Une demi-heure dans l’eau, peu importe la distance.',
 'duration', '{"min_duration_seconds": 1800, "sport_types": ["swim"], "window": "day", "effort": "single"}',
 'swim', 'facile', 14, 'day', null),

('Natation : 3 km cumulés en 10 jours',
 'Toutes vos séances de dix jours s’additionnent.',
 'distance', '{"min_distance_meters": 3000, "sport_types": ["swim"], "window": "multi_day", "effort": "cumulative"}',
 'swim', 'moyen', 45, 'multi_day', 10)

) as v(title, description, evaluator, config, sport_family, difficulty,
       points, duration_scope, duration_days)
where e.year = 2026
  -- Rejouable : un défi déjà présent sous ce titre n'est pas réinséré.
  and not exists (
    select 1
    from public.challenges c
    where c.edition_id = e.id
      and c.title = v.title
  );

-- -------------------------------------------------------------------------
-- Contrôle
--
-- Doit renvoyer 70, et une répartition qui ressemble à celle annoncée en tête
-- de fichier. Si le total est plus bas, c'est qu'un défi portait déjà ce titre.
-- -------------------------------------------------------------------------

select
  sport_family,
  count(*) as defis,
  count(*) filter (where duration_scope = 'multi_day') as fils_rouges,
  min(points) as points_min,
  max(points) as points_max
from public.challenges c
join public.editions e on e.id = c.edition_id
where e.year = 2026
  and c.is_active
group by rollup (sport_family)
order by sport_family nulls last;
