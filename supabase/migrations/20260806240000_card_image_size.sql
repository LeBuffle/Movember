-- =========================================================================
-- Le seau `cartes` accepte des visuels plus lourds (story 5.6, révisée)
--
-- La limite était de 2 Mo, posée avant qu'aucune carte n'existe. Les visuels
-- réels — illustrations détaillées en résolution d'impression — pèsent entre
-- trois et six mégaoctets sans que personne ait rien fait de travers. La
-- limite refusait donc le travail normal.
--
-- **Elle reste une limite**, et pour la même raison qu'avant : l'album
-- affiche une douzaine de ces images d'un coup, sur un téléphone, souvent en
-- données mobiles. Ce qui est téléversé est payé par chaque participant qui
-- ouvre l'écran, à chaque fois. Huit mégaoctets laissent la place au visuel
-- tel qu'il sort du générateur ; ce n'est pas une invitation à le publier
-- ainsi.
--
-- ⚠️ La limite du seau et celle du code doivent rester identiques. Une base
-- plus permissive que l'application donne un refus applicatif là où le
-- fichier serait passé ; l'inverse donne une erreur de stockage incompréhen-
-- sible après une longue attente de téléversement. `MAX_IMAGE_BYTES` dans
-- `src/lib/cards/form.ts` porte la même valeur, et un test les compare.
-- =========================================================================

update storage.buckets
   set file_size_limit = 8388608 -- 8 MiB
 where id = 'cartes';
