# Mise en route — l'ordre des opérations

Ce document est la liste unique de ce qui reste à faire côté PO, dans l'ordre où il faut le
faire. Chaque ligne renvoie à la story qui la détaille.

Il est écrit pour être suivi **sur ordinateur**, sauf les points explicitement marqués
« téléphone » — et ceux-là ne se vérifient nulle part ailleurs.

---

## Étape 0 — Savoir où on en est

Avant tout, vérifier ce qui est déjà en base. Dans Supabase → **SQL Editor** :

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

La liste attendue une fois **toutes** les migrations passées :

`activities`, `activity_connections`, `activity_consents`, `admin_audit_log`,
`card_grants`, `card_rarities`, `cards`, `challenge_assignments`, `challenges`,
`common_challenges`, `editions`, `leaderboard_settings`, `news_posts`,
`notification_deliveries`, `notification_preferences`, `payments`, `profiles`,
`push_subscriptions`, `registration_tiers`, `registrations`, `shipping_addresses`,
`team_members`, `teams`, `activity_flags`, `integrity_settings`, `card_packs`,
`pack_purchases`.

Ce qui manque dans cette liste indique par où reprendre.

---

## Étape 1 — Les migrations, dans l'ordre du nom de fichier

Supabase → **SQL Editor** → **New query** → coller le contenu du fichier → **Run**.
Puis la suivante. **L'ordre compte** : chaque migration suppose les précédentes.

| # | Fichier | Story |
| --- | --- | --- |
| 1 | `20260803000000_initial_schema.sql` | 1.6 |
| 2 | `20260804000000_admin_audit_log.sql` | 1.10 |
| 3 | `20260804100000_registrations_payments.sql` | 2.1 |
| 4 | `20260804110000_terms_acceptance.sql` | 2.2 |
| 5 | `20260804120000_challenges.sql` | 4.1 |
| 6 | `20260805100000_shipping_addresses.sql` | 2.7 |
| 7 | `20260805110000_refunds.sql` | 2.8 |
| 8 | `20260805120000_challenge_evidence.sql` | 4.3 |
| 9 | `20260805130000_catchup_assignments.sql` | 4.4 |
| 10 | `20260805140000_common_challenges.sql` | 4.8 |
| 11 | `20260805150000_challenge_arbitration.sql` | 4.10 |
| 12 | `20260805160000_activities.sql` | 3.1 |
| 13 | `20260805170000_activity_consent.sql` | 3.2 |
| 14 | `20260806100000_activity_connections.sql` | 3.3 |
| 15 | `20260806110000_connection_refresh.sql` | 3.7 |
| 16 | `20260806120000_activity_minimisation.sql` | 3.4 |
| 17 | `20260806130000_cards.sql` | 5.1 |
| 18 | `20260806140000_grant_card_with_completion.sql` | 5.3 |
| 19 | `20260806150000_card_images.sql` | 5.6 |
| 20 | `20260806160000_card_reveal.sql` | 5.5 |
| 21 | `20260806170000_push_subscriptions.sql` | 6.1 |
| 22 | `20260806180000_notification_deliveries.sql` | 6.3 |
| 23 | `20260806190000_notification_preferences.sql` | 6.7 |
| 24 | `20260806200000_teams.sql` | 7.1 |
| 25 | `20260806210000_leaderboards.sql` | 7.3 |
| 26 | `20260806220000_news_posts.sql` | 7.8 |
| 27 | `20260806230000_display_name_is_final.sql` | 1.13 |
| 28 | `20260806240000_card_image_size.sql` | 5.6 |
| 29 | `20260806250000_participant_suspension.sql` | 8.7 |
| 30 | `20260806260000_activity_flags.sql` | 9.6 |
| 31 | `20260806270000_card_packs.sql` | 10.1 |
| 32 | `20260806280000_account_deletion.sql` | 11.2 |

⚠️ **La 29 reconstruit la vue des classements** : quelques secondes sans classement pendant
qu'elle tourne. Elle se rafraîchit elle-même à la fin — rien à lancer après.

Puis, **en dernier**, rejouer `seed.sql`. Il est rejouable sans risque et crée l'édition
2026, les trois niveaux d'inscription et les deux packs de cartes.

Deux commandes à passer **une seule fois**, après la migration 25 :

```sql
-- Peuple la vue des classements. Elle est vide tant qu'on ne l'a pas fait,
-- et tous les écrans de classement afficheront un classement vide.
select public.refresh_leaderboards();
```

Enfin, se donner le rôle administrateur — après s'être inscrit par l'application :

```sql
update public.profiles set role = 'admin' where email = 'votre@email.fr';
```

---

## Étape 2 — Les secrets sur le serveur de préproduction

Tous dans `deploy/.env.staging`, sur le VPS, en `chmod 600`.
**Aucune de ces valeurs ne doit passer par notre conversation ni par le dépôt.**

| Variable | Comment l'obtenir | Story |
| --- | --- | --- |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` | 3.3 |
| `CRON_SECRET` | `openssl rand -base64 32` | 1.4 |
| `ACCESS_CODE` | au choix, 6 caractères minimum. **Jamais en production** | 1.3 |
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés d'API, **mode test** (`sk_test_`) | 2.3 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | même page (`pk_test_`) | 2.3 |
| `STRIPE_WEBHOOK_SECRET` | après l'étape 3 ci-dessous (`whsec_`) | 2.4 |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | réglages de l'application Strava | 3.3 |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | au choix, une chaîne quelconque | 3.5 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` | 6.1 |
| `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` | compte Resend — **septembre** | 6.4 |

⚠️ **Les clés VAPID se génèrent une seule fois.** Les changer invalide silencieusement tous
les abonnements existants : les navigateurs continuent de fonctionner, les envois
continuent d'être rejetés, et rien ne dit pourquoi.

---

## Étape 3 — Les services extérieurs

> **Resend a sa propre fiche : [`resend.md`](resend.md).** C'est le dernier bloquant
> d'ouverture — vérification du domaine, réglage SMTP de Supabase, variables de
> l'application, et le calcul de quota à faire avant novembre.

### Stripe (mode test)

1. Développeurs → Webhooks → **Ajouter un point de terminaison**
   - Adresse : `https://staging.defi-movember.fr/api/webhooks/stripe`
   - Événements : `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`, `charge.succeeded`, `charge.updated`,
     `charge.refunded`
2. Ouvrir le point de terminaison → **Secret de signature** → Révéler → le poser dans
   `STRIPE_WEBHOOK_SECRET`, puis redéployer.

*(stories 2.4, 2.6, 2.8)*

### Strava

1. Réglages de l'application → **Authorization Callback Domain** : `staging.defi-movember.fr`
   — sans `https://`, sans chemin. Strava refuse la redirection sinon.
2. Créer l'abonnement au webhook. **Un seul abonnement par application** : préproduction
   **ou** production, jamais les deux.

   ```bash
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=VOTRE_ID \
     -F client_secret=VOTRE_SECRET \
     -F callback_url=https://staging.defi-movember.fr/api/webhooks/strava \
     -F verify_token=LA_VALEUR_DE_STRAVA_WEBHOOK_VERIFY_TOKEN
   ```

*(stories 3.3, 3.5)*

### Supabase

Ajouter les adresses de retour aux **Redirect URLs** : celle de la préproduction, et
`https://defi-movember.fr/**` avant la mise en production. *(story 1.4)*

### En septembre — Resend

⚠️ **Créer le compte et authentifier le domaine d'expédition (SPF, DKIM) en septembre, pas
en octobre.**

> **Ce point bloque les inscriptions elles-mêmes, pas seulement les notifications.**
> Le service d'e-mail intégré de Supabase est limité à quelques envois par heure — la
> limite a été atteinte en préproduction le 6 août avec moins de dix essais. Sans un
> service d'envoi réel branché dans **Authentication → Emails → SMTP Settings**, la
> dixième personne à s'inscrire un jour d'ouverture ne peut pas créer de compte.
>
> Le même compte Resend sert aux deux usages : la confirmation d'inscription et le repli
> e-mail des notifications (story 6.4). Un domaine neuf qui envoie huit cents e-mails d'un coup part en indésirable,
et la réputation d'un domaine se construit lentement. C'est aussi ce qui débloque la story
2.5 (e-mail de bienvenue), la seule story développée qui attend encore quelque chose.
*(story 6.4)*

---

## Étape 4 — Les tâches planifiées

**Ne jamais ajouter une ligne de cron à la main sur le serveur** : le déploiement suivant
l'effacerait sans rien dire. Tout passe par `deploy/crontab`, qui s'installe seul au
déploiement de production.

En préproduction, elles ne tournent pas. Pour en déclencher une à la main :

```bash
source /opt/defi-movember/deploy/.env.staging
curl -H "x-cron-secret: $CRON_SECRET" https://staging.defi-movember.fr/api/cron/<tâche>
```

| Tâche | Quand | Ce qu'elle fait | Story |
| --- | --- | --- | --- |
| `ping` | 5:07 | Preuve que le mécanisme marche | 1.4 |
| `defis-du-jour` | 5:04 | Attribue et notifie le défi du jour | 4.4, 6.5 |
| `jetons` | :41 | Renouvelle les jetons Strava avant expiration | 3.7 |
| `rattrapage` | :17 | Récupère les sorties que le webhook a perdues | 3.6 |
| `rapprochement` | :23 | Complète les frais Stripe réels | 2.6 |
| `classements` | :03, :18, :33, :48 | Rafraîchit les huit classements | 7.3 |
| `purge` | 4:34 | Applique la politique de conservation. **Répond « rien à faire » onze mois par an** | 11.4 |

Et une tâche qui n'est pas un appel HTTP mais un script :

| Script | Quand | Ce qu'il fait | Story |
| --- | --- | --- | --- |
| `backup-database.sh` | 3:12 | Sauvegarde la base, sept copies conservées | 11.5 |
| `check-resources.sh` | toutes les 10 min | Surveille disque et mémoire | 1.11 |

⚠️ La sauvegarde passe **avant** la purge, et cet ordre est vérifié par un test : une
sauvegarde prise après la purge serait la sauvegarde de l'état déjà purgé.

---

## Étape 5 — La recette, dans l'ordre du parcours d'un participant

À faire sur la préproduction, avec **deux comptes de test** — c'est la condition de la
moitié de ces vérifications.

### Paiement et inscription

- [ ] Payer une inscription avec `4242 4242 4242 4242`. Attendu au retour :
      « votre inscription est confirmée », et `/jeu` accessible. *(2.4)*
- [ ] Abandonner un paiement (flèche retour de Stripe) : « rien n'a été prélevé ». *(2.3)*
- [ ] Carte refusée `4000 0000 0000 0002` : rien ne change chez nous. *(2.3)*
- [ ] **Renvoyer deux ou trois fois** l'événement `checkout.session.completed` depuis
      Stripe. Attendu : toujours **une seule** ligne dans `payments`. *(2.4)*
- [ ] Avec un compte qui n'a pas payé : `/jeu` doit être refusé. *(2.4)*
- [ ] `/admin/collecte` : montant encaissé, frais réels, taux constaté. Rapprocher au
      centime contre Stripe. *(2.6)*
- [ ] Rembourser un paiement de test, vérifier les **deux** lignes comptables, puis
      vérifier qu'un second remboursement est refusé. *(2.8)*
- [ ] Niveau 2 ou 3 : le rappel d'adresse apparaît, le formulaire s'enregistre.
      Niveau 1 : rien. Puis `/admin/livraisons` → CSV → **ouvrir dans Excel et vérifier les
      accents**. *(2.7)*

### Défis

- [ ] Créer un défi de **chaque type** depuis `/admin/defis`, **sur téléphone** — c'est le
      vrai test de l'écran. *(4.2, 4.7)*
- [ ] Le banc d'essai : mettre `0,005` en distance et voir que tout passe. C'est la faute
      d'unité rendue visible. *(4.3)*
- [ ] Lancer l'attribution du jour, puis **l'appuyer une seconde fois** : zéro nouvelle
      attribution. *(4.4)*
- [ ] Injecter les activités simulées : le défi doit se valider tout seul. *(3.1)*
- [ ] Programmer un défi commun, vérifier le refus d'une date passée, annuler. *(4.8)*
- [ ] Arbitrer un défi à la main : valider puis invalider, et vérifier qu'il ne se
      revalide pas tout seul ensuite. *(4.10)*

### Strava

- [ ] Autoriser, connecter, annuler chez Strava, reconnecter, déconnecter. *(3.3, 3.8)*
- [ ] Vérifier qu'un second compte ne peut pas relier le même compte Strava. *(3.3)*
- [ ] Après déconnexion, vérifier dans les réglages Strava que l'application **n'y figure
      plus** — c'est ce qui distingue une vraie déconnexion. *(3.8)*
- [ ] **Vérifier que la liaison survit à la nuit** : reconnecter, revenir le lendemain. *(3.7)*
- [ ] `/admin/etat` : l'écran de santé des remontées. *(3.9)*

### Cartes

- [ ] Vérifier que le seau `cartes` apparaît dans Storage, marqué « Public ». *(5.6)*
- [ ] Créer une carte avec son visuel, la publier, vérifier qu'elle apparaît après un défi
      validé. *(5.6)*
- [ ] Vérifier qu'une carte **publiée** ne propose plus de bouton de suppression. *(5.6)*
- [ ] La révélation : interrompre l'animation d'un appui, puis « ajouter à ma
      collection ». *(5.5)*
- [ ] **Sur iPhone**, Réglages → Accessibilité → Mouvement → Réduire les animations : la
      carte doit apparaître sans animation. *(5.5)*
- [ ] `/cartes` en navigation privée. *(5.8)*

### Notifications — **sur de vrais appareils, un iPhone et un Android**

Un émulateur n'installe pas sur un écran d'accueil ; cette partie ne se vérifie nulle part
ailleurs.

- [ ] **iPhone / Safari** : `/installer`, les cinq étapes, rouvrir depuis l'écran
      d'accueil. *(6.2)*
- [ ] **Android / Chrome** : le bouton « Installer » apparaît, et les étapes écrites
      restent justes s'il n'apparaît pas. *(6.2)*
- [ ] Activer les notifications, puis lancer l'attribution du jour et constater la
      notification. *(6.1, 6.5)*
- [ ] Injecter une activité qui valide **plusieurs** défis d'un coup : **une seule**
      notification doit arriver. *(6.6)*
- [ ] Décocher une catégorie, enregistrer, recharger : elle doit rester décochée. *(6.7)*
- [ ] `/admin/notifications` : s'envoyer un message, puis **appuyer sur retour et
      renvoyer** — aucune seconde notification ne doit arriver. *(6.8)*
- [ ] Une fois Resend en place : e-mail de repli, puis le lien de désabonnement **en
      navigation privée**. *(6.4)*

### Équipes et classements

- [ ] Créer une équipe, relever le code, la rejoindre avec le second compte. Puis vérifier
      que le second compte **ne voit pas** le code. *(7.1, 7.9)*
- [ ] Exclure, transmettre le rôle de capitaine, quitter. *(7.2)*
- [ ] `/admin/equipes` : créer une équipe d'entreprise, désigner un capitaine. *(7.2)*
- [ ] Depuis un compte au milieu du classement : la ligne personnelle apparaît en bas avec
      son rang réel. *(7.4)*
- [ ] Lire la phrase d'explication de la normalisation d'équipe telle qu'elle s'affiche. *(7.5)*
- [ ] Tableau de bord avec un compte actif, puis avec un compte sans activité. *(7.6)*
- [ ] Page d'accueil **en navigation privée** : comparer le montant affiché au total de
      `/admin/collecte`. Identiques au centime. *(7.7)*
- [ ] Écrire un message d'actualité **depuis un téléphone**, avec une photo prise sur
      place. Épingler, publier, modifier, dépublier. *(7.8)*

### ⚠️ La vérification qui reste due depuis l'epic 4

- [ ] **Avec deux comptes réels, vérifier qu'un participant ne voit pas les données de
      l'autre** : historique de défis, collection, activités, adresse, code d'équipe.
      C'est la sécurité au niveau des lignes, et c'est le seul type de défaut qui ne
      produit **aucun symptôme visible** jusqu'au jour où il est public.
      **À faire avant l'ouverture des inscriptions.** *(story 11.9, notée depuis 4.9)*

---

## Étape 6 — Les décisions qui n'attendent que vous

Aucune ne bloque le code aujourd'hui, toutes changent le contenu de septembre.

| Décision | Pourquoi maintenant | Story |
| --- | --- | --- |
| **Cumul des distances** : « Parcourir 5 km » = une sortie de 5 km (actuel) ou plusieurs sorties additionnées dans la journée ? | Change la rédaction des 60–80 défis | 4.3 |
| **Durée de conservation des données d'activité** : 12 mois après l'édition (actuel) ou moins ? | Une ligne à changer aujourd'hui ; une reprise de tous les consentements plus tard | 3.2 |
| **Exposant de normalisation d'équipe** : 0,5 par défaut | `update public.leaderboard_settings set team_exponent = …;` — effet immédiat, sans déploiement | 7.5 |
| **Le « 100 % reversé »** au vu du taux de frais Stripe réellement constaté | L'écran `/admin/collecte` vous donne le chiffre | 2.6 |
| **Participants hors métropole ?** Le jour d'une sortie est calculé à l'heure de Paris | Seule situation où ça se remarque | 3.4 |

---

## Étape 7 — Avant la production

1. **DNS** : `defi-movember.fr` et `www` pointent sur le VPS. Sans quoi Traefik ne peut pas
   obtenir de certificat. *(1.4)*
2. **`deploy/.env.production`** renseigné, dont `CRON_SECRET`. **Sans `ACCESS_CODE`.** *(1.4)*
3. **Secret GitHub `SUPABASE_DB_URL`** — sans lui le job de migrations échoue et rien ne se
   déploie. *(1.4)*
4. **`https://defi-movember.fr/**` dans les Redirect URLs de Supabase.** *(1.4)*
5. **Déplacer l'abonnement webhook Strava** de la préproduction vers la production — il n'y
   en a qu'un. *(3.5)*
6. **Déclarer le webhook Stripe de production**, en **mode réel** cette fois, et récupérer
   son propre secret de signature. *(2.4)*
7. **Compte de surveillance externe** (uptime) et **projet Sentry**, avec une erreur
   provoquée pour vérifier. *(1.11)*
8. **Vérifier le redémarrage automatique** par un arrêt provoqué (`docker kill`). *(1.11)*
9. **Éprouver le runbook** et recevoir les accès. *(1.11)*
10. **Fusionner `main`.** Rien n'est en ligne avant : la mise en production est une
    décision, pas un effet de bord. *(1.4)*
11. **Éprouver le retour arrière pour de vrai**, une fois qu'il existe deux versions en
    production. *(1.4)*

---

## Étape 8 — La conformité et le lancement (epic 11)

Ces points ne peuvent pas être faits à votre place. Les trois premiers sont les critères de
sortie de l'epic 11.

1. **Installer le client Postgres** sur le VPS : `apt install -y postgresql-client`. *(11.5)*
2. **Renseigner `DATABASE_URL`** dans `deploy/.env`, en `chmod 600`.
   Supabase → Project Settings → Database → Connection string → **URI**, connexion
   **directe** et non le pooler.
   ⚠️ Cette chaîne contient le mot de passe de la base : **elle ne se colle que sur le
   serveur**, jamais dans une conversation ni dans un e-mail. *(11.5)*
3. **Lancer une première sauvegarde** :
   `sudo bash /opt/defi-movember/deploy/scripts/backup-database.sh` *(11.5)*
4. **⭐ Restaurer une sauvegarde** dans une base d'essai, en suivant `docs/runbook.md` §13.
   ⚠️ Jamais sur la base de production. **C'est le critère de sortie de l'epic.** *(11.5)*
5. **⭐ Auditer le durcissement du serveur** :
   `sudo bash /opt/defi-movember/deploy/scripts/check-hardening.sh`
   Corriger les lignes rouges, en gardant une session SSH de secours ouverte pour les deux
   qui touchent SSH. Puis le relancer jusqu'au tout-vert. *(11.8)*
6. **Remplir les mentions légales** : dénomination, siège, numéro RNA, directeur de
   publication, contact, hébergeur. Elles affichent « à compléter » — visiblement, plutôt
   que d'inventer des valeurs que personne ne remarquerait fausses. *(11.6)*
7. **Trancher la politique de remboursement** (point P6). La section 9 des CGV porte une
   proposition, marquée en italique. *(11.6)*
8. **Relire les trois pages légales** de bout en bout. Ce sont les seuls textes qui engagent
   l'association devant chaque participant. *(11.6)*
9. **Effacer un compte de test relié à Strava**, puis vérifier dans les réglages Strava que
   l'autorisation a disparu, et dans l'écran Collecte que la ligne comptable subsiste sans
   désigner personne. *(11.2)*
10. **Télécharger l'export de ses données** et l'ouvrir. *(11.1)*
11. **Un parcours au clavier** (Tab uniquement) et **un parcours au lecteur d'écran** sur
    téléphone. Une demi-heure, et elle vaut tous les tests structurels. *(11.7)*
12. **⭐ La répétition générale**, autour du 8 octobre : `docs/repetition-generale.md`, de
    bout en bout, en cochant. C'est la story la plus importante de tout le projet. *(11.9)*

---

## Le travail de contenu — septembre

Rien de technique, et c'est ce qui prend le plus de temps.

- **60 à 80 défis** dans le catalogue, de tous les types.
- **Une cinquantaine de visuels de cartes.**
- **CGV et mentions légales définitives.** Quand elles le sont, passer `TERMS_VERSION`
  dans `src/lib/legal/notices.ts` — c'est ce qui distingue les acceptations d'avant et
  d'après. Même chose pour `CONSENT_VERSION` si le texte du consentement change sur le
  fond. *(2.2, 3.2)*
- **Confirmer les durées de conservation** annoncées dans la politique de confidentialité :
  trois mois pour les adresses postales, six pour les activités. Elles sont générées depuis
  `src/lib/privacy/retention.ts`, donc exactes — mais ce sont des décisions, pas des
  contraintes techniques. *(11.4)*
- **Confirmer le prix des packs** (point P3) : deux packs proposés à 3 € et 6 €. Ils vivent
  en base : les changer prend une instruction SQL. *(10.1)*

---

## Une dette technique, à trancher à froid

`npm audit` signale **trois vulnérabilités « high »** (postcss, sharp), héritées de
Next.js 15. Les corriger suppose de passer à Next.js 16 — une montée de version majeure.
Ce n'est ni urgent ni anodin : à décider hors d'une session de développement, et pas en
octobre.
