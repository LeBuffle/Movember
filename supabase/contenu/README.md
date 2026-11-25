# Sauvegarde du contenu — avant la mise en pause du projet

> Écrit le 25 novembre 2026, avant la suppression du projet Supabase
> `umzvkjdwtxrkfysmggaq` pour arrêter les 10 $ par mois pendant la pause.

## Ce qu'il faut comprendre d'abord

**La base de données n'était pas le point de sauvegarde.** Presque tout ce
qu'elle contenait était déjà dans ce dépôt, et s'y recrée tout seul :

| Ce qu'il y avait en base | Où ça vit vraiment |
| --- | --- |
| Les 35 tables, leurs règles, leurs sécurités | `supabase/migrations/` — 39 fichiers |
| L'édition, les 3 niveaux, les 2 packs, les lots de crédits, les raretés | `supabase/seed.sql` |
| Les 70 défis du catalogue | `supabase/challenges-2026.sql` |
| Les réglages (classements, contrôles d'intégrité, plafond de défis) | valeurs par défaut des migrations — **aucune n'avait été modifiée** |

Il ne manquait que **trois choses**, et ce dossier les contient.

## Ce que ce dossier sauve

| Fichier | Contenu | Pourquoi ça ne pouvait pas se recréer |
| --- | --- | --- |
| `cartes/` | **6 visuels de cartes** (3,6 Mo) | Téléversés dans le stockage Supabase, jamais dans le dépôt. Une suppression de projet efface aussi le stockage |
| `01-cartes.sql` | **5 cartes publiées** | Créées dans le back-office, pas dans le seed |
| `02-defis-ajoutes.sql` | **3 défis ajoutés à la main** | Idem — et ils ressemblent à des doublons de recette, à relire |

⚠️ `6a289e12-f24d-40ed-a5db-bb781b1dbf55.jpg` est un doublon exact, à l'octet
près, de `3c3076af-…jpg`, et aucune carte ne le référence. Conservé par
prudence, pas par nécessité.

## Ce qui n'a **pas** été sauvegardé, et pourquoi

Six comptes de test, huit paiements en mode test Stripe, vingt sorties
sportives, un fil d'actualité d'essai (« test notification — Coucou, tu es
pret pour lancer la machine !!! »), une équipe et une super-équipe de recette.
**Tout date du 4 au 13 août 2026 ; la base n'a plus rien enregistré depuis.**

Trois raisons de ne pas les garder :

1. **Ça ne vaut rien.** Se réinscrire avec la carte de test
   `4242 4242 4242 4242` prend dix minutes et redonne un jeu d'essai propre.
2. **Ce sont des données personnelles** — adresses e-mail, une adresse
   postale, des sorties sportives. Les conserver pendant une pause de durée
   inconnue, sans finalité, serait exactement ce que le RGPD demande d'éviter
   (`CLAUDE.md` §6).
3. Aucune obligation comptable : les paiements sont en **mode test**, aucun
   euro réel n'a été encaissé, et l'édition n'a jamais ouvert.

## Recréer la base, le jour où le projet reprend

Compter une demi-heure. La procédure détaillée est dans
`docs/mise-en-route.md` ; voici l'ordre, et ce dossier à la fin.

1. **Créer un projet Supabase**, région `eu-west-3`.
2. **Passer les 39 migrations** de `supabase/migrations/`, dans l'ordre du nom
   de fichier, dans l'éditeur SQL.
3. **Passer `supabase/seed.sql`.**
   ⚠️ Il recrée l'édition avec ses **vraies dates** (inscriptions au 15
   octobre, jeu au 1er novembre) et en statut `draft`. L'ancienne base avait
   ces dates avancées au 1er août et le statut `open` : c'était un réglage de
   recette, pas une configuration à retrouver.
4. **Passer `supabase/challenges-2026.sql`** — les 70 défis.
5. **Créer le seau de stockage `cartes`**, public, puis y téléverser les six
   fichiers de `supabase/contenu/cartes/` **sans renommer aucun d'eux**.
6. **Passer `supabase/contenu/01-cartes.sql`**, après y avoir remplacé la
   référence de l'ancien projet par celle du nouveau (une seule ligne, elle
   est signalée dans le fichier).
7. *(facultatif)* `supabase/contenu/02-defis-ajoutes.sql`, après avoir vérifié
   que ces trois défis ne font pas doublon.
8. Créer le seau `logos`, public — il était vide, rien à y remettre.
9. Se réinscrire par l'application, puis se donner le rôle administrateur :
   `update public.profiles set role = 'admin' where email = '…';`

Les nouvelles clés du projet remplacent les anciennes dans
`deploy/.env.production` et `deploy/.env.staging` sur le serveur. **Aucune
d'elles ne doit passer par une conversation ni par ce dépôt** (`CLAUDE.md` §9).

## Vérifier que la restauration a réussi

```sql
select
  (select count(*) from public.challenges)        as defis,        -- 70 ou 73
  (select count(*) from public.cards)             as cartes,       -- 5
  (select count(*) from public.registration_tiers) as niveaux,     -- 3
  (select count(*) from public.card_packs)        as packs,        -- 2
  (select count(*) from public.editions)          as editions;     -- 1
```

Puis ouvrir une carte dans le back-office : si son visuel s'affiche, le lien
entre la base et le stockage est bon. S'il ne s'affiche pas, c'est l'étape 6
qui a été lancée sans remplacer la référence du projet.

## Ce qui a été vérifié, et ce qui ne l'a pas été

| Point | État |
| --- | --- |
| `01-cartes.sql` | ✅ **exécuté pour de vrai** sur la base du 25 novembre — passe, et rejouable : relancé, il n'insère rien en double |
| `02-defis-ajoutes.sql` | ✅ **exécuté pour de vrai**, idem. Le test a d'ailleurs trouvé une erreur (des conversions de type inventées) qui aurait fait échouer le fichier le jour de la restauration |
| Les 6 visuels | ✅ téléchargés et contrôlés : 6 JPEG valides, 1054 × 1492, tailles identiques à l'octet près à celles du stockage |
| La procédure complète sur un projet neuf | ⬜ **non répétée** — elle suppose un nouveau projet Supabase, donc de payer. Chaque étape vient de `docs/mise-en-route.md`, qui a servi au montage initial |
