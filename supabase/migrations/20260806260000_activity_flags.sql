-- =========================================================================
-- Signalement des activités aberrantes (stories 9.6, 9.7, 9.9)
--
-- **Signaler, jamais rejeter** (architecture D10). La raison est sociale, pas
-- technique : un faux positif qui invalide le défi d'un participant honnête
-- fait plus de dégâts qu'un tricheur qui passe. Le premier arrête de jouer et
-- le raconte ; le second gagne un classement auquel personne ne tient
-- vraiment.
--
-- Une activité signalée ouvre donc un dossier. Le défi se valide, les points
-- sont accordés, la carte est donnée. Si l'arbitrage conclut à la triche,
-- l'invalidation d'un défi existe déjà (story 4.10) et elle est tracée.
-- =========================================================================

-- Les seuils, en base et non dans le code (story 9.9)
--
-- Même raisonnement que l'exposant du classement d'équipe : un réglage qui
-- sera discuté en novembre ne doit pas demander un développeur. Un excès de
-- faux positifs le troisième jour se corrige en une commande.
create table public.integrity_settings (
  id boolean primary key default true check (id),

  -- Vitesse moyenne au-delà de laquelle une course à pied est douteuse.
  -- 25 km/h : le record du monde du marathon tourne autour de 21 km/h, et un
  -- sprinter de haut niveau tient 37 km/h sur cent mètres. Au-delà de 25 sur
  -- une sortie entière, quelque chose mérite d'être regardé.
  max_run_speed_kmh numeric not null default 25
    check (max_run_speed_kmh > 0),

  -- 60 km/h à vélo : descente de col comprise, une moyenne au-delà sur une
  -- sortie complète relève de la voiture.
  max_bike_speed_kmh numeric not null default 60
    check (max_bike_speed_kmh > 0),

  -- Une sortie de plus de douze heures est possible — ultra-trail, brevet —
  -- mais assez rare pour valoir un regard.
  max_duration_hours numeric not null default 12
    check (max_duration_hours > 0),

  -- Un dénivelé positif supérieur à ce que la distance permet : 300 m de D+
  -- par kilomètre est déjà de l'alpinisme.
  max_elevation_per_km numeric not null default 300
    check (max_elevation_per_km > 0),

  updated_at timestamptz not null default now()
);

insert into public.integrity_settings (id) values (true)
on conflict (id) do nothing;

alter table public.integrity_settings enable row level security;

-- Lisible par l'organisation seule : ces seuils disent à un tricheur
-- exactement sous quelle barre rester.
create policy "admins read integrity settings"
  on public.integrity_settings for select
  to authenticated
  using ((select public.is_admin()));

create policy "admins write integrity settings"
  on public.integrity_settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

comment on table public.integrity_settings is
  'Seuils de signalement, réglables sans redéploiement (story 9.9). Non lisibles des participants : ils diraient sous quelle barre rester.';

-- -------------------------------------------------------------------------
-- La file d'arbitrage
-- -------------------------------------------------------------------------
create table public.activity_flags (
  id uuid primary key default gen_random_uuid(),

  activity_id uuid not null references public.activities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- La règle déclenchée, en clair. « Vitesse moyenne 47 km/h en course à
  -- pied » se juge ; « activité suspecte » ne se juge pas.
  rule text not null check (length(rule) between 1 and 60),
  -- La valeur constatée et le seuil dépassé, pour que l'arbitre décide sans
  -- rouvrir la sortie chez Strava.
  observed numeric not null,
  threshold numeric not null,
  unit text not null check (length(unit) between 1 and 20),

  -- `pending` tant que personne n'a tranché ; ensuite, définitif.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  resolution_reason text
    check (resolution_reason is null or length(resolution_reason) between 3 and 500),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,

  created_at timestamptz not null default now()
);

-- Une même activité n'est signalée qu'une fois par règle : une resynchro-
-- nisation ne doit pas faire réapparaître un cas déjà tranché.
create unique index activity_flags_once
  on public.activity_flags (activity_id, rule);

-- La file elle-même : ce qui attend, du plus ancien au plus récent.
create index activity_flags_pending_idx
  on public.activity_flags (created_at)
  where status = 'pending';

alter table public.activity_flags enable row level security;

-- **Aucune politique de lecture pour les participants.** Savoir qu'on a été
-- signalé, et pour quelle règle, c'est savoir exactement quoi ajuster.
create policy "admins read the arbitration queue"
  on public.activity_flags for select
  to authenticated
  using ((select public.is_admin()));

-- **Aucune politique d'écriture, pour personne.** Les signalements sont posés
-- par la clé de service au moment où l'activité arrive, et l'arbitrage passe
-- par une action serveur qui vérifie le rôle. La sécurité au niveau des
-- lignes filtre des LIGNES et non des COLONNES : qui pourrait écrire
-- `status` pourrait écarter son propre signalement.

comment on table public.activity_flags is
  'File d''arbitrage. Signaler, jamais rejeter (architecture D10) : le défi se valide quand même, seul l''arbitrage humain tranche.';

comment on column public.activity_flags.status is
  'pending, puis accepted (l''activité est jugée valable) ou dismissed (écartée). Un cas tranché ne revient jamais dans la file.';
