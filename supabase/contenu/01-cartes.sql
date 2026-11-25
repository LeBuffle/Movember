-- =========================================================================
-- DEFI Movember — les 5 cartes créées dans le back-office
--
-- **Ce fichier existe parce que ces cartes n'étaient nulle part ailleurs.**
-- Les migrations recréent la structure, le seed recrée la configuration, le
-- catalogue recrée les défis — mais une carte publiée depuis le back-office
-- ne vit que dans la base. Supprimer le projet Supabase les emportait.
--
-- À passer APRÈS les migrations, le seed et `challenges-2026.sql`.
--
-- ⚠️ UNE SEULE CHOSE À MODIFIER AVANT DE LANCER CE FICHIER
--
-- La ligne `base_url` ci-dessous contient la référence de l'ANCIEN projet
-- Supabase. Remplacez `umzvkjdwtxrkfysmggaq` par la référence du nouveau
-- projet — elle est dans l'adresse de votre tableau de bord Supabase, et
-- dans `NEXT_PUBLIC_SUPABASE_URL`.
--
-- Les visuels correspondants sont dans `supabase/contenu/cartes/`. Il faut
-- les téléverser dans le seau `cartes` du nouveau projet AVANT de lancer ce
-- fichier, **en conservant exactement les mêmes noms de fichiers** : ce sont
-- eux qui font le lien.
--
-- Rejouable sans risque : une carte déjà présente sous le même identifiant
-- n'est pas réinsérée.
-- =========================================================================

do $$
declare
  base_url text := 'https://umzvkjdwtxrkfysmggaq.supabase.co/storage/v1/object/public/cartes/';
  edition uuid;
begin
  select id into edition from public.editions where year = 2026;

  if edition is null then
    raise exception 'Édition 2026 introuvable : passez seed.sql avant ce fichier.';
  end if;

  insert into public.cards (id, edition_id, title, description, rarity, image_path, published_at)
  values
    ('cbc51008-7687-48d1-9da3-fc89be69ff25', edition, 'Moustache en harmonie', '',
     'commune', base_url || '3c3076af-472b-4c5a-b166-13efdad95103.jpg', '2026-08-11 10:46:23.393+00'),
    ('a29e9ba3-2bbd-4dc9-819d-1f48196a1e67', edition, 'moustache en accord', '',
     'commune', base_url || '7f8c1fec-e284-411b-95cf-7f40680c1471.jpg', '2026-08-11 10:48:10.33+00'),
    ('6d936527-8cbc-4b69-a2a3-2dfe241b958c', edition, 'roie des pirates', '',
     'rare', base_url || 'cb6c4660-61ac-43b8-9e00-76980ad8f107.jpg', '2026-08-11 10:48:51.464+00'),
    ('0a1bdb1f-4dbf-4633-b578-6fa3e8543329', edition, 'Moustache hors limites', '',
     'epique', base_url || '108e8144-84a6-4f8e-865b-22ba30466cc4.jpg', '2026-08-11 10:50:30.157+00'),
    ('4f426622-2144-41b4-98ab-8aece5da36de', edition, 'moustache artisan du bonheur', '',
     'commune', base_url || '01491df7-15c7-4be4-a733-f07a5b7d7071.jpg', '2026-08-11 10:54:18.367+00')
  on conflict (id) do nothing;
end $$;

-- Contrôle : doit afficher 5.
select count(*) || ' carte(s) en base' as resultat from public.cards;
