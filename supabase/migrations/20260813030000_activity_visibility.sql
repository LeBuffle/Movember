-- =========================================================================
-- DEFI Movember — ce qui est privé chez le fournisseur (story 15.1)
--
-- **L'application voit ce que le participant a caché.** La portée
-- `activity:read_all` demandée à Strava lui donne accès aux sorties masquées
-- — c'est nécessaire pour valider les défis de quelqu'un qui ne publie rien.
--
-- Le journal des sorties de l'epic 15 change la nature de cette lecture : ce
-- qui n'était vu que par le moteur d'évaluation devient visible par six cents
-- personnes. Republier une sortie que son auteur a masquée serait une fuite,
-- pas un réglage : la portée sert à valider ses défis, jamais à publier à sa
-- place.
-- =========================================================================

-- **`true` par défaut, et c'est tout le raisonnement.**
--
-- Les sorties déjà en base ne portent pas l'information — elles ont été
-- importées avant que la question ne se pose. Et **ne rien dire n'est pas
-- dire non** : les publier rétroactivement reviendrait à décider à la place
-- de leur auteur, sur la foi d'une donnée qu'on n'a jamais eue.
--
-- Elles restent donc masquées jusqu'à un réimport, qui rétablit la valeur
-- réelle. Le défaut inverse aurait été plus commode et faux.
alter table public.activities
  add column if not exists is_private boolean not null default true;

comment on column public.activities.is_private is
  'Masquée chez le fournisseur au moment de l''import. Vrai par défaut : une sortie dont on ne sait rien est traitée comme privée (story 15.1).';

-- Le journal lit les dix dernières sorties visibles d'une personne, par
-- famille de sport. Sans cet index, c'est un parcours de toutes ses sorties
-- à chaque ouverture d'un dépliant.
create index if not exists activities_journal_idx
  on public.activities (profile_id, sport_family, started_at desc)
  where is_private = false;

-- -------------------------------------------------------------------------
-- Rien d'autre ne change
--
-- Le caractère privé **ne touche pas au jeu** : la sortie valide les défis,
-- compte dans les classements sportifs et alimente les compteurs collectifs
-- exactement comme les autres. C'est une règle d'affichage, et elle ne doit
-- jamais devenir une règle de score — quelqu'un qui ne publie rien joue
-- autant que les autres.
--
-- Aucune politique d'accès n'est ajoutée : `activities` n'en porte aucune
-- pour personne, et la lecture du journal (story 15.3) passe par une vue
-- dédiée qui ne rend que les colonnes publiables.
-- -------------------------------------------------------------------------

-- -------------------------------------------------------------------------
-- Le réglage du participant (story 15.2)
--
-- **Activé par défaut, coupable en un geste** (décision J1). Un accord
-- préalable aurait été plus prudent et aurait raté sa cible : personne ne
-- trouve un réglage facultatif, la liste serait vide chez la plupart, et la
-- fonctionnalité n'aurait servi à rien.
--
-- Même arbitrage et même forme que `duels_opt_out` de l'epic 12 : un
-- « opt-out » stocké en négatif, pour que la valeur par défaut d'une colonne
-- neuve — `false` — soit le comportement voulu, et non l'inverse.
--
-- Couper l'affichage ne touche ni au rang, ni aux points, ni aux défis : les
-- sorties restent en base et continuent de tout alimenter. Un retrait qui
-- coûterait un classement est un retrait que personne n'ose, et un réglage
-- que personne n'ose n'est pas un réglage.
-- -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists activities_opt_out boolean not null default false;

comment on column public.profiles.activities_opt_out is
  '« Ne pas montrer mes sorties aux autres participants » (story 15.2). N''a aucun effet sur le classement.';

-- La vue publique porte le réglage, pour qu'un écran sache avant d'ouvrir un
-- dépliant qu'il n'y aura rien dedans. Ajoutée en fin de liste : une vue
-- remplacée peut gagner des colonnes, jamais les réordonner.
--
-- ⚠️ Le filtre reste **exactement** celui de la migration 34. Y ajouter
-- `suspended_at is null` aurait fait disparaître le pseudonyme d'un suspendu
-- des listes d'équipe et des défis entre joueurs — un changement défendable,
-- mais qui n'a rien à faire ici et que personne n'aurait demandé. Le journal
-- exclut les suspendus par sa propre lecture (story 15.3).
create or replace view public.public_profiles as
  select id, display_name, avatar_url, duels_opt_out, activities_opt_out
  from public.profiles
  where deleted_at is null;
