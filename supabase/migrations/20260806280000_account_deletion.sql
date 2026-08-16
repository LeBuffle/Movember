-- =========================================================================
-- DEFI Movember — l'effacement d'un compte (story 11.2)
--
-- Le schéma était prêt : presque tout ce qui est personnel est en
-- `on delete cascade` depuis `profiles`, et `payments.profile_id` est en
-- `on delete set null` — la ligne comptable survit, le lien vers la personne
-- est rompu. C'est exactement ce que demande l'epic 11.
--
-- Deux obstacles restaient, et cette migration les lève. Tous deux
-- feraient échouer l'effacement, pas le dégrader : le droit à l'effacement
-- ne peut pas dépendre du fait qu'on capitaine une équipe.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Le pseudonyme peut être neutralisé au moment de l'effacement
--
-- Le déclencheur de la story 1.13 interdit toute modification du pseudonyme
-- à quiconque n'est pas administrateur. L'effacement passe par la clé de
-- service, pour laquelle `auth.uid()` est nul : `is_admin()` répond faux et
-- le déclencheur refuse.
--
-- L'exception est délibérément la plus étroite possible : elle n'ouvre le
-- changement que sur la transition qui pose `deleted_at`, c'est-à-dire une
-- seule fois dans la vie d'une ligne, et jamais en sens inverse.
-- -------------------------------------------------------------------------
create or replace function public.forbid_display_name_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
     and not public.is_admin()
     -- L'effacement du compte : la ligne devient supprimée dans la même
     -- instruction. Un pseudonyme conservé sur un compte effacé resterait
     -- une donnée personnelle.
     and not (old.deleted_at is null and new.deleted_at is not null) then
    raise exception
      'Le pseudonyme est fixé à l''inscription et ne peut plus être modifié (profil %)',
      old.id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.forbid_display_name_change() is
  'Le pseudonyme ne change plus après l''inscription. Deux exceptions : l''organisation, et l''effacement du compte.';

-- -------------------------------------------------------------------------
-- 2. Le capitaine d'une équipe peut effacer son compte
--
-- `teams.captain_id` était en `on delete restrict` : la suppression d'un
-- profil capitaine échouait, et avec elle toute la cascade. Une équipe sans
-- capitaine est un vrai problème — personne ne peut y inviter, personne ne
-- peut l'administrer — mais le refus n'est pas la bonne réponse : le droit à
-- l'effacement n'est pas négociable contre une fonction dans une équipe.
--
-- La réponse est applicative et vient avant la suppression (voir
-- `src/lib/privacy/deletion.ts`) : la capitainerie passe au membre le plus
-- ancien, ou l'équipe est dissoute si le capitaine était seul. Ce déclencheur
-- est le filet en dessous — le jour où un chemin oublie de le faire, l'équipe
-- est dissoute au lieu de bloquer l'effacement.
-- -------------------------------------------------------------------------
create function public.dissolve_team_without_captain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Le membre le plus ancien qui n'est pas la personne effacée.
  update public.teams t
     set captain_id = (
           select m.profile_id
             from public.team_members m
            where m.team_id = t.id
              and m.profile_id <> old.id
            order by m.joined_at asc
            limit 1
         ),
         updated_at = now()
   where t.captain_id = old.id
     and exists (
       select 1 from public.team_members m
        where m.team_id = t.id and m.profile_id <> old.id
     );

  -- Plus personne d'autre : l'équipe part avec son capitaine. Rien n'est
  -- perdu — défis, points et cartes appartiennent au participant, jamais à
  -- l'équipe.
  delete from public.teams t
   where t.captain_id = old.id;

  return old;
end;
$$;

comment on function public.dissolve_team_without_captain() is
  'Avant l''effacement d''un profil : la capitainerie passe au membre le plus ancien, ou l''équipe est dissoute.';

create trigger profiles_release_captaincy
  before delete on public.profiles
  for each row
  execute function public.dissolve_team_without_captain();

comment on trigger profiles_release_captaincy on public.profiles is
  'Le droit à l''effacement ne peut pas être bloqué par une capitainerie (story 11.2).';
