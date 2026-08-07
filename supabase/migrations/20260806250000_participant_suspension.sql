-- =========================================================================
-- Suspendre un participant (story 8.7)
--
-- Une fonction qu'on espère ne jamais utiliser. Cela ne la rend pas
-- facultative : un comportement inacceptable pendant le mois doit pouvoir
-- recevoir une réponse, et devoir écrire à un développeur pour l'obtenir
-- serait la garantie qu'elle n'arrive pas.
--
-- **Suspendre n'est pas rembourser.** L'inscription et le paiement restent
-- intacts : ce qu'il advient de l'argent est une décision distincte, prise
-- ailleurs (story 2.8) et par quelqu'un qui y a réfléchi. Confondre les deux
-- dans un seul geste, c'est prendre la seconde décision sans l'avoir voulu.
--
-- **Réversible**, parce qu'une suspension posée dans l'urgence d'un dimanche
-- doit pouvoir être levée le lundi sans laisser de trace dans le jeu.
-- =========================================================================

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  -- Le motif vit avec la suspension, pas seulement dans le journal : c'est
  -- lui qui s'affiche à la personne qui reprend le dossier trois semaines
  -- plus tard, et le journal peut être long à parcourir.
  add column if not exists suspension_reason text
    check (suspension_reason is null or length(suspension_reason) between 3 and 500),
  add column if not exists suspended_by uuid references public.profiles (id);

comment on column public.profiles.suspended_at is
  'Écarté du jeu par l''organisation. L''inscription et le paiement restent intacts.';

comment on column public.profiles.suspension_reason is
  'Obligatoire à la pose. Doit pouvoir être relu et compris par quelqu''un qui n''a pas pris la décision.';

-- Une suspension sans motif n'en est pas une : elle deviendrait invérifiable
-- le jour où elle est contestée. La garde est ici plutôt que dans le
-- formulaire, parce qu'un formulaire se contourne et qu'une contrainte non.
alter table public.profiles
  drop constraint if exists profiles_suspension_needs_reason;

alter table public.profiles
  add constraint profiles_suspension_needs_reason
  check (
    (suspended_at is null and suspension_reason is null)
    or (suspended_at is not null and suspension_reason is not null)
  );

-- Seule l'organisation suspend. La politique « un participant met à jour son
-- propre profil » existe toujours, et la sécurité au niveau des lignes filtre
-- des LIGNES et non des COLONNES : sans ce déclencheur, un participant
-- pourrait lever sa propre suspension par une requête directe.
create function public.forbid_self_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.suspended_at is distinct from old.suspended_at
      or new.suspension_reason is distinct from old.suspension_reason)
     and not public.is_admin() then
    raise exception
      'Seule l''organisation peut suspendre ou rétablir un participant (profil %)',
      old.id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.forbid_self_suspension() is
  'La suspension ne se pose et ne se lève que par l''organisation.';

create trigger profiles_suspension_is_admin_only
  before update on public.profiles
  for each row
  execute function public.forbid_self_suspension();

-- -------------------------------------------------------------------------
-- Un suspendu disparaît des classements
--
-- Sans quoi son pseudonyme resterait affiché à six cents personnes — ce qui
-- est précisément ce qu'on voulait éviter en le suspendant.
--
-- La vue est recréée plutôt que filtrée à la lecture : la règle appartient à
-- l'endroit où la donnée est calculée. Un filtre applicatif serait à répéter
-- dans les classements individuels, le classement d'équipe et les compteurs
-- collectifs, et le premier oublié annulerait la mesure.
--
-- ⚠️ La vue est vide tant qu'elle n'a pas été rafraîchie une fois. La
-- dernière instruction de ce fichier s'en charge.
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
  select
    act.profile_id,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'run'), 0
    )::bigint as run_distance_meters,
    coalesce(
      sum(act.distance_meters) filter (where act.sport_family = 'bike'), 0
    )::bigint as bike_distance_meters,
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
  activity_count,
  total_duration_seconds,
  rank() over (partition by edition_id order by points desc) as rank_points,
  rank() over (partition by edition_id order by challenges_succeeded desc) as rank_challenges,
  rank() over (partition by edition_id order by cards_earned desc) as rank_cards,
  rank() over (partition by edition_id order by run_distance_meters desc) as rank_run,
  rank() over (partition by edition_id order by bike_distance_meters desc) as rank_bike,
  rank() over (partition by edition_id order by activity_count desc) as rank_activities,
  rank() over (partition by edition_id order by total_duration_seconds desc) as rank_duration,
  now() as computed_at
from base;

comment on materialized view public.leaderboard_entries is
  'Les huit classements, en une passe. Le classement général ne lit jamais card_grants ; le classement collection ne compte que challenge et daily_draw (architecture D8, D14). Les comptes suspendus en sont absents (story 8.7).';

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

-- Peuplée tout de suite : une vue matérialisée est vide tant qu'elle n'a pas
-- été rafraîchie, et laisser cette étape au PO après une migration qui
-- recrée la vue serait lui tendre un piège.
refresh materialized view public.leaderboard_entries;
