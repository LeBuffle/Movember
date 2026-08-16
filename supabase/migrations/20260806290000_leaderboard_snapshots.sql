-- =========================================================================
-- DEFI Movember — la photographie quotidienne des rangs (story 13.1)
--
-- **« Il a pris 3 places » n'a aucun sens sans point de comparaison**, et ce
-- point de comparaison n'existait nulle part : la vue matérialisée de la
-- story 7.3 ne connaît que le classement de maintenant.
--
-- Comparer au rafraîchissement précédent donnerait un écart sur quinze
-- minutes — c'est-à-dire aucun. Une photographie datée permet de dire
-- « depuis hier matin », et surtout de l'écrire à l'écran : un écart dont on
-- ignore la période est une information qu'on croit comprendre.
--
-- Volume : une ligne par participant et par jour, soit quelques dizaines de
-- milliers sur l'édition. Négligeable, et purgé avec le reste (story 11.4).
-- =========================================================================

create table public.leaderboard_snapshots (
  edition_id uuid not null references public.editions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- Le jour de la prise de vue, en date locale. C'est la clé qui rend la
  -- tâche rejouable : deux passages le même jour ne créent qu'une ligne.
  taken_on date not null,

  rank_points integer not null,
  rank_challenges integer not null,
  rank_cards integer not null,
  rank_run integer not null,
  rank_bike integer not null,
  rank_activities integer not null,
  rank_duration integer not null,

  created_at timestamptz not null default now(),

  primary key (edition_id, profile_id, taken_on)
);

comment on table public.leaderboard_snapshots is
  'Les rangs de chaque participant, une fois par jour. C''est le repère qui donne un sens à « +3 places » (story 13.1).';

comment on column public.leaderboard_snapshots.taken_on is
  'Jour de la prise de vue. Clé primaire avec le participant : deux passages le même jour ne créent qu''une ligne.';

-- La lecture se fait toujours « pour cette édition, ce jour-là ».
create index leaderboard_snapshots_day_idx
  on public.leaderboard_snapshots (edition_id, taken_on);

-- -------------------------------------------------------------------------
-- La prise de vue
--
-- **Elle ne calcule rien.** Elle recopie les rangs de la vue matérialisée
-- telle qu'elle est à cet instant. C'est ce qui rend cette story incapable de
-- fausser un classement : elle lit, elle écrit ailleurs, elle ne touche à
-- rien.
--
-- `on conflict do nothing` plutôt qu'un `update` : la photographie du jour
-- est celle du matin. Une relance à midi ne doit pas la remplacer par
-- l'état de midi — sinon « depuis hier matin » devient faux sans prévenir.
--
-- @returns le nombre de lignes réellement écrites. Zéro veut dire « déjà
--   prise aujourd'hui », ce qui est un succès et non un échec.
-- -------------------------------------------------------------------------
create function public.snapshot_leaderboard_ranks(p_day date default null)
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
    rank_run, rank_bike, rank_activities, rank_duration
  )
  select
    e.edition_id, e.profile_id, v_day,
    e.rank_points, e.rank_challenges, e.rank_cards,
    e.rank_run, e.rank_bike, e.rank_activities, e.rank_duration
  from public.leaderboard_entries e
  on conflict (edition_id, profile_id, taken_on) do nothing;

  get diagnostics v_written = row_count;

  return v_written;
end;
$$;

comment on function public.snapshot_leaderboard_ranks(date) is
  'Recopie les rangs du jour depuis la vue matérialisée. Rejouable : un second passage le même jour n''écrit rien.';

-- -------------------------------------------------------------------------
-- Accès
-- -------------------------------------------------------------------------

alter table public.leaderboard_snapshots enable row level security;

-- Les rangs d'hier sont aussi publics que ceux d'aujourd'hui : c'est tout
-- l'objet d'un classement. Rien de personnel n'est ici — pas de pseudonyme,
-- pas de valeur, seulement une position.
create policy "tout le monde lit les photographies"
  on public.leaderboard_snapshots for select
  to anon, authenticated
  using (true);

-- Aucune politique d'écriture, pour personne. La photographie est prise par
-- la clé de service, une fois par jour. Quelqu'un capable d'écrire ici
-- pourrait se fabriquer une progression flatteuse — le seul chiffre de cet
-- epic qui puisse être truqué.
