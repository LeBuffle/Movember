-- =========================================================================
-- DEFI Movember — le classement Marche (demande PO du 13 août)
--
-- **Les classements « sportifs » se nourrissent déjà des sorties elles-mêmes,
-- pas des défis.** Course, Vélo, Sorties et Temps sont calculés directement
-- depuis `activities`, sans passer par la moindre affectation : un
-- participant qui court cent kilomètres sans jamais valider un défi apparaît
-- au classement Course, et c'est le cas depuis la story 7.3.
--
-- Il manquait la marche. Elle existe comme famille de sport depuis l'epic 3 —
-- les défis peuvent la demander — mais aucun classement ne la comptait. Or
-- c'est la famille la plus accessible : celle qui donne une place honorable
-- à qui ne court pas et ne roule pas, et l'edition vise six cents personnes
-- dont beaucoup ne sont pas des sportifs.
--
-- Deux objets bougent ensemble, et c'est la raison de ce fichier unique : la
-- vue qui calcule le rang, et la photographie quotidienne qui le conserve.
-- Ajouter l'un sans l'autre donnerait un classement sans progression « depuis
-- hier », ce qui se remarque le lendemain.
-- =========================================================================

-- -------------------------------------------------------------------------
-- La photographie d'abord
--
-- Elle doit accepter la nouvelle colonne avant que la fonction ne l'écrive.
-- `not null` aurait refusé les lignes déjà prises ; une valeur par défaut
-- serait un faux rang. Nullable dit la vérité : « avant cette migration, ce
-- rang n'existait pas ».
-- -------------------------------------------------------------------------
alter table public.leaderboard_snapshots
  add column if not exists rank_walk integer;

comment on column public.leaderboard_snapshots.rank_walk is
  'Nul pour les photographies prises avant l''ajout du classement Marche. La progression « depuis hier » s''en accommode : elle n''affiche rien plutôt qu''un faux écart.';

-- -------------------------------------------------------------------------
-- La vue
--
-- Recréée, parce qu'une vue matérialisée n'accepte pas de colonne ajoutée.
-- Le reste est repris à l'identique de la migration 25 — les commentaires qui
-- portent les règles d'intégrité y compris, puisque ce sont ces règles qui
-- font que l'argent ne touche jamais au jeu.
--
-- ⚠️ La vue est vide tant qu'elle n'a pas été rafraîchie. La dernière
-- instruction de ce fichier s'en charge.
-- -------------------------------------------------------------------------

drop materialized view if exists public.leaderboard_entries;

create materialized view public.leaderboard_entries as
with participants as (
  -- Inscriptions actives, et comptes non suspendus. Quelqu'un qui a
  -- abandonné en cours de paiement, qui a été remboursé, ou qui a été écarté
  -- n'est pas dans le jeu.
  select r.profile_id, r.edition_id
  from public.registrations r
  join public.profiles pr on pr.id = r.profile_id
  where r.status = 'active'
    and pr.suspended_at is null
    and pr.deleted_at is null
),

challenge_totals as (
  select
    a.profile_id,
    a.edition_id,
    coalesce(sum(a.points_awarded), 0)::bigint as points,
    count(*)::bigint as challenges_succeeded
  from public.challenge_assignments a
  where a.status = 'completed'
  group by a.profile_id, a.edition_id
),

card_totals as (
  select
    g.profile_id,
    g.edition_id,
    -- **Uniquement ce qui a été gagné en jouant.** Une carte d'un pack acheté
    -- ou du bonus de niveau 3 enrichit une collection, jamais un score (D8).
    count(distinct g.card_id)::bigint as cards_earned
  from public.card_grants g
  where g.source in ('challenge', 'daily_draw')
  group by g.profile_id, g.edition_id
),

activity_totals as (
  -- **Lu depuis les sorties, jamais depuis les défis.** C'est ce qui permet
  -- à quelqu'un qui vise le kilométrage sans se soucier des défis d'exister
  -- au classement — et c'était déjà vrai pour la course et le vélo.
  select
    act.profile_id,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'run'), 0
    )::bigint as run_distance_meters,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'bike'), 0
    )::bigint as bike_distance_meters,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'walk'), 0
    )::bigint as walk_distance_meters,
    count(*)::bigint as activity_count,
    coalesce(sum(act.duration_seconds), 0)::bigint as total_duration_seconds
  from public.activities act
  group by act.profile_id
),

base as (
  select
    p.profile_id,
    p.edition_id,
    m.team_id,
    coalesce(c.points, 0) as points,
    coalesce(c.challenges_succeeded, 0) as challenges_succeeded,
    coalesce(k.cards_earned, 0) as cards_earned,
    coalesce(t.run_distance_meters, 0) as run_distance_meters,
    coalesce(t.bike_distance_meters, 0) as bike_distance_meters,
    coalesce(t.walk_distance_meters, 0) as walk_distance_meters,
    coalesce(t.activity_count, 0) as activity_count,
    coalesce(t.total_duration_seconds, 0) as total_duration_seconds
  from participants p
  left join challenge_totals c
    on c.profile_id = p.profile_id and c.edition_id = p.edition_id
  left join card_totals k
    on k.profile_id = p.profile_id and k.edition_id = p.edition_id
  left join activity_totals t
    on t.profile_id = p.profile_id
  left join public.team_members m
    on m.profile_id = p.profile_id and m.edition_id = p.edition_id
)

select
  profile_id,
  edition_id,
  team_id,
  points,
  challenges_succeeded,
  cards_earned,
  run_distance_meters,
  bike_distance_meters,
  walk_distance_meters,
  activity_count,
  total_duration_seconds,
  rank() over (partition by edition_id order by points desc) as rank_points,
  rank() over (partition by edition_id order by challenges_succeeded desc) as rank_challenges,
  rank() over (partition by edition_id order by cards_earned desc) as rank_cards,
  rank() over (partition by edition_id order by run_distance_meters desc) as rank_run,
  rank() over (partition by edition_id order by bike_distance_meters desc) as rank_bike,
  rank() over (partition by edition_id order by walk_distance_meters desc) as rank_walk,
  rank() over (partition by edition_id order by activity_count desc) as rank_activities,
  rank() over (partition by edition_id order by total_duration_seconds desc) as rank_duration,
  now() as computed_at
from base;

comment on materialized view public.leaderboard_entries is
  'Les neuf classements, en une passe. Les quatre classements sportifs se lisent depuis activities et ne dépendent d''aucun défi. Le classement général ne lit jamais card_grants ; le classement collection ne compte que challenge et daily_draw (architecture D8, D14). Les comptes suspendus en sont absents (story 8.7).';

-- Index unique : c'est lui qui rend possible le rafraîchissement
-- `concurrently`, sans lequel le classement devient vide pour tout le monde
-- pendant quelques secondes, quatre fois par heure.
create unique index leaderboard_entries_profile
  on public.leaderboard_entries (profile_id, edition_id);

create index leaderboard_entries_points_idx
  on public.leaderboard_entries (edition_id, rank_points);

create index leaderboard_entries_team_idx
  on public.leaderboard_entries (edition_id, team_id);

revoke all on public.leaderboard_entries from anon, authenticated;
grant select on public.leaderboard_entries to anon, authenticated;

-- -------------------------------------------------------------------------
-- La photographie écrit le nouveau rang
-- -------------------------------------------------------------------------
create or replace function public.snapshot_leaderboard_ranks(p_day date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'Europe/Paris')::date);
  v_written integer;
begin
  insert into public.leaderboard_snapshots (
    edition_id, profile_id, taken_on,
    rank_points, rank_challenges, rank_cards,
    rank_run, rank_bike, rank_walk, rank_activities, rank_duration
  )
  select
    e.edition_id, e.profile_id, v_day,
    e.rank_points, e.rank_challenges, e.rank_cards,
    e.rank_run, e.rank_bike, e.rank_walk, e.rank_activities, e.rank_duration
  from public.leaderboard_entries e
  on conflict (edition_id, profile_id, taken_on) do nothing;

  get diagnostics v_written = row_count;

  return v_written;
end;
$$;

-- Peuplée tout de suite : une vue matérialisée est vide tant qu'elle n'a pas
-- été rafraîchie, et laisser cette étape au PO après une migration qui
-- recrée la vue serait lui tendre un piège.
refresh materialized view public.leaderboard_entries;
