-- =========================================================================
-- Le pseudonyme est fixé à l'inscription (story 1.13)
--
-- Il est choisi au moment de créer le compte et ne change plus. Trois
-- raisons, dans l'ordre où elles comptent :
--
--   1. **Il est l'identité publique du participant.** Il figure dans sept
--      classements, sur les pages d'équipe et dans l'historique. Quelqu'un
--      qui en change au milieu du mois disparaît pour ses coéquipiers, qui
--      cherchent un nom qui n'existe plus.
--   2. **Un classement doit être stable.** « Qui est passé devant moi cette
--      nuit ? » ne doit jamais avoir pour réponse « la même personne, sous
--      un autre nom ».
--   3. Un pseudonyme modifiable à volonté est un vecteur d'abus : on
--      concourt sous un nom correct et on en prend un autre le dernier jour,
--      quand les captures d'écran circulent.
--
-- **Pourquoi un déclencheur et pas une politique.** La sécurité au niveau
-- des lignes filtre des LIGNES, pas des COLONNES. La politique « un
-- participant met à jour son propre profil » existe et doit continuer
-- d'exister — c'est elle qui permettra plus tard de changer une préférence.
-- Elle ne peut pas distinguer « il modifie sa préférence » de « il modifie
-- son pseudonyme ». Seul un déclencheur le peut.
--
-- L'organisation reste capable de corriger : un pseudonyme insultant ou une
-- faute de frappe le jour de l'inscription doivent pouvoir se réparer, et
-- c'est un geste tracé dans le journal du back-office.
-- =========================================================================

create function public.forbid_display_name_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
     and not public.is_admin() then
    raise exception
      'Le pseudonyme est fixé à l''inscription et ne peut plus être modifié (profil %)',
      old.id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.forbid_display_name_change() is
  'Le pseudonyme ne change plus après l''inscription. Seule l''organisation peut le corriger.';

create trigger profiles_display_name_is_final
  before update on public.profiles
  for each row
  execute function public.forbid_display_name_change();

comment on trigger profiles_display_name_is_final on public.profiles is
  'Identité publique stable : le pseudonyme figure dans sept classements et sur les pages d''équipe.';
