# DEFI Movember — Document d'Architecture

| | |
| --- | --- |
| **Version** | v1 — Phase 3 BMAD (Architect) |
| **Date** | 3 août 2026 |
| **Auteur** | Agent Architect (BMAD) |
| **Statut** | En attente de validation PO |
| **Documents amont** | [`docs/brief.md`](brief.md) v1.1 · [`docs/prd.md`](prd.md) v1 |
| **Projet de départ** | Greenfield — aucun starter, aucun code existant |

Ce document est la référence technique unique du projet. Il couvre le frontend, le
backend, la base de données, les intégrations et le déploiement.

### Journal des versions

| Date | Version | Description | Auteur |
| --- | --- | --- | --- |
| 2026-08-03 | v1 | Rédaction initiale à partir du PRD v1 | Agent Architect |

---

## 1. Résumé pour le Product Owner

*Cette section est écrite sans vocabulaire technique. Le reste du document entre dans le
détail.*

**Ce qu'on construit.** Un site web unique qui s'installe comme une application sur les
téléphones. Il y a trois portes d'entrée : les pages publiques que tout le monde peut
voir, l'espace des participants, et le back-office de l'équipe organisatrice. Tout vit
dans un même programme — pas de découpage compliqué, parce qu'à cette taille ça
n'apporterait que des ennuis.

**Les briques retenues.** Next.js pour le site, Supabase pour la base de données et les
comptes, Stripe pour les paiements, Strava pour les activités sportives, Vercel pour
l'hébergement. Ce sont les mêmes outils que sur tes autres projets, ils sont gratuits ou
quasi gratuits à notre taille, et ce sont les plus rapides à mettre en œuvre. C'est ce
dernier point qui a pesé le plus : la ressource la plus rare du projet, c'est le temps,
pas l'argent.

**Le point le plus important du document.** Les défis et les cartes ne sont **pas écrits
dans le code**. Ils sont enregistrés dans la base de données comme des fiches. Créer un
défi ou une carte en plein mois de novembre, c'est remplir un formulaire dans le
back-office — pas me demander de modifier le programme. C'est ce qui rend la promesse de
la refonte tenable, et ça conditionne une bonne partie des choix techniques qui suivent.

**Ce que ça va coûter.** Rien pendant le développement. Environ **40 € par mois d'octobre
à décembre**, soit **environ 130 € pour toute l'édition** — 1,3 % d'une collecte de
10 000 €. Le détail est en section 12. Une précision honnête : le PRD visait moins de
30 € par mois, et j'arrive à 40 € sur les trois mois critiques. La différence vient de
deux postes que je ne recommande pas de sacrifier — les sauvegardes quotidiennes de la
base et l'envoi des e-mails de secours. Sur l'année entière, la moyenne reste bien
en dessous de 30 €.

**Les trois choses qui peuvent faire échouer le projet, et aucune n'est technique.**
L'autorisation de Strava, le compte Stripe, et le prix de la médaille. Je peux tout
construire ; je ne peux pas les débloquer.

**Une alerte que je dois formuler clairement.** Le concept repose sur des classements
entre participants construits à partir de données Strava. Le contrat développeur de
Strava encadre strictement ce type d'usage. **Tant que ce point n'est pas confirmé par
Strava, l'architecture décrite ici reste valable mais le jeu pourrait devoir être
ajusté.** J'ai conçu le système pour que cet ajustement reste possible sans tout refaire
— c'est l'objet de la décision D3 ci-dessous — mais ça ne remplace pas la vérification.

---

## 2. Vue d'ensemble

### 2.1 Synthèse technique

Application **Next.js (App Router, TypeScript)** déployée sur **Vercel**, adossée à
**Supabase** (PostgreSQL, authentification, stockage de fichiers, sécurité au niveau des
lignes). L'application sert les trois parcours — public, participant, administrateur —
depuis un même dépôt et un même déploiement.

Les traitements de fond (synchronisation Strava, évaluation des défis, envoi des
notifications, calcul des classements) sont déclenchés par **événements** — un webhook
Strava, un webhook Stripe — ou par **tâches planifiées** exécutées depuis Supabase. Le
contenu du jeu (défis, cartes, règles de tirage, seuils anti-triche) est **stocké en base
de données**, jamais codé en dur.

Les paiements passent par **Stripe Checkout** : aucune donnée de carte ne touche
l'application. Les notifications utilisent le **Web Push** standard via un service
worker, avec un **repli e-mail** systématique. Une **couche d'abstraction « source
d'activité »** isole Strava, pour que Garmin puisse s'ajouter plus tard sans refonte.

### 2.2 Schéma général

```
┌──────────────────────────────────────────────────────────────────────┐
│                          NAVIGATEUR / PWA                            │
│   Pages publiques  │  Espace participant  │  Back-office admin       │
│                    Service Worker (cache + push)                     │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS
┌────────────────────────────────▼─────────────────────────────────────┐
│                    NEXT.JS sur VERCEL (région eu)                    │
│  Rendu serveur  │  Server Actions  │  Route Handlers (webhooks, API) │
└───┬───────────────────┬──────────────────┬───────────────────┬───────┘
    │                   │                  │                   │
┌───▼────────────┐ ┌────▼──────┐ ┌─────────▼────────┐ ┌────────▼──────┐
│   SUPABASE     │ │  STRIPE   │ │      STRAVA      │ │   RESEND      │
│ (Frankfurt)    │ │           │ │                  │ │  (e-mails)    │
│ • PostgreSQL   │ │ Checkout  │ │ OAuth 2.0        │ │               │
│ • Auth         │ │ Webhooks  │ │ Webhooks         │ │               │
│ • Storage      │ │ Refunds   │ │ API activités    │ │               │
│ • RLS          │ │           │ │                  │ │               │
│ • Edge Funcs   │ └───────────┘ └──────────────────┘ └───────────────┘
│ • pg_cron ─────┼─► tâches planifiées (rattrapage, classements,
└────────────────┘    publication du défi, relances)
```

### 2.3 Choix de plateforme

**Retenu : Vercel + Supabase.**

| Critère | Vercel + Supabase | VPS Hostinger | AWS |
| --- | --- | --- | --- |
| Coût mensuel à notre volume | ~40 € (3 mois) | ~5-10 € | 15-40 €, imprévisible |
| Temps de mise en route | quelques heures | 2-3 jours | 1 semaine+ |
| Maintenance système | nulle | à notre charge | partielle |
| Déploiement continu | inclus | à construire | à construire |
| Sauvegardes | incluses (offre payante) | à construire | à configurer |
| Cohérence avec les autres projets du PO | totale | partielle | nulle |

**Alternative écartée : VPS Hostinger.** Moins cher de 30 € par mois, mais impose de
gérer soi-même le système, les certificats, les sauvegardes et le déploiement. Sur un
projet où une seule personne développe en huit semaines, ces trois jours de mise en place
et la charge d'exploitation pendant novembre coûtent plus cher que les 30 € économisés.
Le critère d'arbitrage du projet dit « le moins coûteux **à qualité égale** » — ici la
qualité n'est pas égale, parce que le risque d'exploitation ne l'est pas.

**Alternative écartée : AWS.** Puissance et prix à l'usage sans rapport avec un projet de
800 utilisateurs ; complexité et délai de mise en œuvre rédhibitoires.

**Régions :** Supabase à Francfort (`eu-central-1`), fonctions Vercel en région
européenne. Toutes les données personnelles restent dans l'Union européenne (NFR10).

### 2.4 Stack détaillée

| Domaine | Technologie | Version cible | Justification |
| --- | --- | --- | --- |
| Langage | TypeScript | 5.x | Typage partagé entre l'interface et le serveur ; réduit les erreurs sans ralentir |
| Framework | Next.js (App Router) | 15.x | Rendu serveur, routes d'API et interface dans un seul projet |
| Interface | React | 19.x | Imposé par Next.js |
| Styles | Tailwind CSS | 4.x | Rapidité de mise en forme, charte centralisée dans un fichier de thème |
| Composants | shadcn/ui | — | Composants copiés dans le dépôt, pas de dépendance figée ; accessibilité correcte par défaut |
| Base de données | PostgreSQL (Supabase) | 15+ | Relationnel, transactions fiables pour la comptabilité et les tirages |
| Authentification | Supabase Auth | — | E-mail/mot de passe, intégré à la sécurité de la base |
| Sécurité des données | Row Level Security | — | Les règles d'accès vivent dans la base, pas seulement dans le code |
| Fichiers | Supabase Storage | — | Visuels des cartes, images du fil d'actualité |
| Tâches planifiées | pg_cron + pg_net | — | Indépendant de l'offre Vercel, gratuit |
| Paiement | Stripe Checkout | API 2025+ | Aucune donnée de carte dans l'application |
| Activités | API Strava | v3 | Imposé |
| Notifications | Web Push (VAPID) + `web-push` | — | Standard, gratuit, sans service tiers |
| PWA | Serwist | 9.x | Service worker moderne, maintenu, compatible App Router |
| E-mails | Resend | — | Repli des notifications et e-mails transactionnels |
| Validation | Zod | 3.x | Contrôle des données entrantes, y compris la configuration des défis |
| Tests unitaires | Vitest | 2.x | Rapide, configuration minimale |
| Tests de bout en bout | Playwright | 1.x | Parcours critiques uniquement |
| Intégration continue | GitHub Actions | — | Gratuit sur dépôt public |
| Supervision | Sentry (offre gratuite) | — | Remontée des erreurs en production |

---

## 3. Décisions d'architecture

Chaque décision indique le compromis accepté et l'alternative écartée.

### D1 — Monolithe applicatif dans un dépôt unique

**Décision.** Une seule application Next.js contenant les pages publiques, l'espace
participant, le back-office et les routes d'API. Un seul dépôt, un seul déploiement.

**Pourquoi.** Une personne développe. Les modèles de données sont partagés entre les
trois parcours. Un découpage en services séparés multiplierait les points de panne et le
temps de mise en route sans aucun gain à 800 utilisateurs.

**Compromis accepté.** L'ensemble se redéploie d'un bloc. À notre échelle, un déploiement
prend moins de deux minutes : c'est sans conséquence.

**Alternative écartée.** Micro-services ou séparation front/back : injustifiable ici.

### D2 — Le contenu du jeu est piloté par les données

**C'est la décision structurante du projet** (exigence NFR18).

**Décision.** Un défi, une carte, une règle de tirage, un seuil anti-triche sont des
**lignes en base de données**, pas du code. Le code fournit un catalogue d'**évaluateurs**
— un par type de défi — et chaque défi est une fiche qui choisit un évaluateur et lui
passe des paramètres.

**En clair.** Créer le défi « 5 km en course à pied aujourd'hui » consiste à remplir un
formulaire : type = distance, sports = course, seuil = 5 km, récompense = 1 carte
commune. Aucun redéploiement.

**Compromis accepté.** Un défi d'un type **totalement nouveau** (un mécanisme jamais
prévu) demande d'ajouter un évaluateur, donc du code. Les sept types du PRD couvrent le
besoin exprimé ; le type `surprise` sert de soupape en combinant les autres.

**Alternative écartée.** Coder chaque défi individuellement : rendrait la promesse du
back-office intenable et remettrait un développeur dans la boucle chaque jour de novembre.

### D3 — Une couche d'abstraction « source d'activité »

**Décision.** L'application ne connaît pas Strava. Elle connaît une interface abstraite
`ActivityProvider` exposant quatre opérations : lancer l'autorisation, échanger le code,
rafraîchir le jeton, normaliser une activité. Strava en est la première implémentation.

Toutes les activités sont converties dans un **format interne unique** (`activities`),
identique quelle que soit la provenance. Le moteur de défis ne lit que ce format.

**Pourquoi.** Garmin doit pouvoir s'ajouter après le lancement sans refonte (NFR19). Et
si le contrat Strava impose une restriction inattendue, cette couche est le seul endroit
à ajuster.

**Compromis accepté.** Une couche d'indirection supplémentaire, écrite alors qu'une seule
source existe. Le coût est d'environ une demi-journée ; le coût d'un rattrapage a
posteriori se compterait en semaines.

**Alternative écartée.** Appeler Strava directement partout : rendrait Garmin
irréalisable et toute contrainte Strava potentiellement fatale.

### D4 — Réception des activités par webhook, avec rattrapage périodique

**Décision.** Strava prévient l'application dès qu'une activité est créée ou modifiée
(*webhook*). L'application récupère alors le détail de cette seule activité. En parallèle,
une tâche planifiée toutes les heures vérifie qu'aucune activité n'a été manquée.

**Pourquoi.** Interroger Strava en boucle pour 800 participants consommerait le quota
d'appels et introduirait un retard. Le webhook est immédiat et économe.

| | Webhook (retenu) | Interrogation périodique |
| --- | --- | --- |
| Délai de prise en compte | quelques secondes | 15 à 60 minutes |
| Appels par jour (800 participants) | ~800 | ~25 000 |
| Robustesse aux pannes | à compléter | naturellement robuste |

**Compromis accepté.** Un webhook peut se perdre. C'est précisément le rôle de la tâche
de rattrapage horaire : filet de sécurité qui rend le système robuste sans le coût du
tout-périodique. Cette combinaison satisfait NFR7 et FR33.

**Alternative écartée.** Interrogation seule : trop lente, trop coûteuse en quota.

### D5 — Paiement par Stripe Checkout hébergé

**Décision.** Le participant est redirigé vers une page de paiement hébergée par Stripe,
puis renvoyé vers l'application. La confirmation ne vient **jamais** de cette redirection
mais du webhook `checkout.session.completed`.

**Pourquoi.** Aucune donnée de carte ne transite par l'application (NFR14), la conformité
réglementaire est portée par Stripe, l'authentification forte est gérée nativement, et
c'est de loin le plus rapide à construire.

**Point important.** La redirection de retour n'est pas une preuve de paiement : elle peut
être fermée, rejouée ou falsifiée. Seul le webhook fait foi. Chaque événement Stripe est
enregistré avec son identifiant unique en clé primaire, ce qui rend le traitement
rejouable sans double comptabilisation (NFR16).

**Compromis accepté.** L'apparence de la page de paiement est moins personnalisable.
Sans importance ici.

**Alternative écartée.** Formulaire de paiement intégré (Payment Element) : plus joli,
plusieurs jours de travail supplémentaires et davantage de responsabilité réglementaire.

### D6 — Web Push natif, avec repli e-mail de premier rang

**Décision.** Notifications via le standard Web Push et des clés VAPID, envoyées depuis
le serveur. Aucun service tiers payant. **Tout participant sans notification push active
reçoit l'équivalent par e-mail** (FR73).

**La contrainte iOS.** Sur iPhone, les notifications web ne fonctionnent **que** si la
PWA a été ajoutée à l'écran d'accueil. L'installation est donc traitée comme une **étape
obligatoire de l'inscription**, avec des instructions détectées selon l'appareil, et un
rappel pour ceux qui l'ont sautée.

**Volume d'e-mails de repli.** Envoyer un e-mail pour chaque événement (défi publié, défi
validé, carte obtenue) représenterait jusqu'à 70 000 e-mails sur le mois. Le repli est
donc **limité aux notifications essentielles** : le défi du jour, les annonces de
l'organisation et les relances. Les validations et les cartes restent dans l'application.

**Compromis accepté.** L'expérience de secours est moins riche que le push — ce qui, par
effet de bord souhaitable, encourage l'installation.

**Alternative écartée.** Service de notification propriétaire (OneSignal, Firebase) :
dépendance externe, complexité de configuration et question RGPD supplémentaire, pour un
besoin que le standard couvre.

### D7 — Tâches planifiées côté base de données

**Décision.** Les traitements récurrents — publication du défi du jour, rattrapage
Strava, recalcul des classements, relance des inactifs, expiration des jetons — sont
déclenchés par `pg_cron` dans Supabase, qui appelle des routes protégées de
l'application.

**Pourquoi.** Les tâches planifiées de Vercel sont limitées en nombre et en fréquence sur
l'offre gratuite. `pg_cron` est inclus dans Supabase sans surcoût et découple le
projet de l'offre d'hébergement.

**Compromis accepté.** La planification n'est pas visible dans le code de l'application
mais dans une migration de base de données. Elle est donc versionnée dans le dépôt, ce
qui préserve la traçabilité.

**Alternative écartée.** Vercel Cron : simple, mais contraint le choix d'offre.

### D8 — Séparation stricte entre classement et collection

**Décision.** Le classement officiel se calcule exclusivement à partir des **défis
réussis et de la performance sportive**. Les cartes possédées **n'entrent dans aucun
classement**. La complétion de l'album est affichée séparément, comme objectif personnel.

**Pourquoi.** Sans cette séparation, acheter des packs ferait monter au classement — ce
que la décision produit D2 du PRD interdit explicitement (NFR20).

**Traduction technique.** Les tables `card_grants` et `challenge_results` sont
indépendantes. Aucune requête de classement ne lit `card_grants`. C'est vérifié par un
test automatisé dédié.

### D9 — Minimisation des données sportives dès la réception

**Décision.** Sur les dizaines de champs renvoyés par Strava pour une activité, on ne
conserve que : identifiant, type de sport, date de début, durée, distance, dénivelé,
vitesse moyenne, et les indicateurs nécessaires à l'anti-triche.

**On ne stocke jamais :** le tracé GPS, les points de départ et d'arrivée, la fréquence
cardiaque, la puissance, la cadence, l'altitude détaillée.

**Pourquoi.** Le tracé et la fréquence cardiaque sont les données les plus sensibles
qu'expose Strava — localisation du domicile et données de santé. Aucun défi du PRD n'en a
besoin. Ne pas les stocker est à la fois la meilleure conformité et la meilleure sécurité :
une donnée absente ne fuite pas.

**Compromis accepté.** Une carte du parcours serait impossible à afficher. Ce n'est pas
au périmètre, et si c'était demandé un jour, ce serait à réétudier avec une base légale
propre.

### D10 — Anti-triche par signalement, jamais par rejet automatique

**Décision.** Les contrôles de cohérence **signalent** une activité, ils ne la rejettent
jamais d'eux-mêmes. Toute activité signalée part dans une file d'arbitrage où
l'administrateur tranche (FR96, FR97).

**Pourquoi.** Un rejet automatique erroné frappe un participant honnête qui ne comprend
pas — c'est le pire résultat possible pour un jeu associatif. Un signalement erroné ne
coûte qu'une validation manuelle.

**Cas particulier des activités saisies à la main sur Strava.** Elles sont écartées de
l'évaluation, conformément à la règle « aucune saisie manuelle » (D5 du PRD). En revanche
les activités **importées depuis une montre** sont acceptées : c'est le cas normal d'un
utilisateur Garmin ou Polar, et les exclure pénaliserait le cœur de cible.

### D11 — Une édition est une donnée, pas une version du logiciel

**Décision.** Tout le contenu (défis, cartes, tarifs, dates, objectifs collectifs) est
rattaché à une **édition** identifiée. L'édition 2026 est un jeu de données.

**Pourquoi.** L'édition 6 doit pouvoir être lancée en changeant des données, pas en
redéveloppant. C'est la vision à deux ans du Brief, et le coût aujourd'hui est d'une
colonne de plus sur quelques tables.

### D12 — Le montant reversé est calculé et figé à l'encaissement

**Décision.** Au moment où un paiement est confirmé, l'application enregistre une ligne
comptable immuable : montant brut, frais Stripe réels, montant net, part reversée, part
affectée à la contrepartie. Les frais réels sont récupérés auprès de Stripe, pas estimés.

**Pourquoi.** Si la grille de répartition évolue en cours d'édition, les paiements déjà
encaissés ne doivent pas changer rétroactivement. Et l'association a besoin d'un compte
rendu rapprochable ligne à ligne avec son relevé Stripe (NFR15).

---

## 4. Modèle de données

### 4.1 Vue d'ensemble

```
editions
   ├── registration_tiers ──┐
   ├── challenges ──────────┼── challenge_results ── profiles
   ├── cards ───────────────┼── card_grants ────────┘
   ├── packs                │
   ├── teams ── team_members┘
   └── news_posts

profiles (1:1 auth.users)
   ├── registrations ── payments ── stripe_events
   ├── activity_connections ── activities ── flagged_activities
   ├── push_subscriptions
   ├── consents
   └── shipping_addresses

leaderboard_entries (vue matérialisée)
admin_audit_log
```

### 4.2 Tables principales

**`editions`** — une ligne par édition annuelle.
`id`, `year`, `name`, `starts_on`, `ends_on`, `registration_opens_on`, `status`
(`draft` | `open` | `running` | `closed`), `collective_goals` (jsonb : km, heures,
montant).

**`profiles`** — prolonge `auth.users`.
`id` (= `auth.users.id`), `display_name` (pseudonyme public, FR22), `email`,
`avatar_url`, `role` (`participant` | `admin`), `created_at`, `deleted_at`.

**`registration_tiers`** — les trois niveaux, en données et non en dur.
`id`, `edition_id`, `code` (`engage` | `chevronne` | `legendaire`), `label`,
`price_cents`, `donation_cents`, `includes_medal`, `bonus_packs`, `description`,
`sort_order`.

> Changer un prix ou un montant reversé est une mise à jour de ligne. Les paiements déjà
> encaissés conservent leur propre copie du montant (décision D12).

**`registrations`** — l'inscription d'une personne à une édition.
`id`, `profile_id`, `edition_id`, `tier_id`, `status` (`pending` | `active` |
`refunded` | `cancelled`), `registered_at`, `team_id`.
Contrainte d'unicité sur (`profile_id`, `edition_id`).

**`payments`** — la comptabilité, immuable après création.
`id`, `registration_id`, `profile_id`, `edition_id`, `kind` (`registration` | `pack`),
`stripe_session_id`, `stripe_payment_intent_id`, `stripe_charge_id`,
`gross_cents`, `fee_cents`, `net_cents`, `donation_cents`, `contrepartie_cents`,
`currency`, `status` (`succeeded` | `refunded` | `partially_refunded`),
`refunded_cents`, `paid_at`, `raw_snapshot` (jsonb).

**`stripe_events`** — garantit qu'un événement n'est traité qu'une fois.
`id` (identifiant Stripe, clé primaire), `type`, `payload` (jsonb), `processed_at`,
`error`.

**`teams`** / **`team_members`**
`teams` : `id`, `edition_id`, `name`, `slug`, `join_code`, `captain_id`, `kind`
(`libre` | `entreprise` | `association`), `created_at`.
`team_members` : `team_id`, `profile_id`, `joined_at`, `role`.

**`activity_connections`** — la liaison à une source d'activité (couche D3).
`id`, `profile_id`, `provider` (`strava` | `garmin` | …), `provider_athlete_id`,
`access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `scopes`,
`status` (`active` | `expired` | `revoked`), `last_synced_at`, `connected_at`.
Unicité sur (`provider`, `provider_athlete_id`) — **empêche deux comptes de jeu de
partager le même compte Strava**, qui serait la triche la plus simple.

**`activities`** — format normalisé, minimisé (décision D9).
`id`, `profile_id`, `connection_id`, `provider`, `provider_activity_id`,
`sport_type` (valeur interne normalisée), `started_at`, `duration_seconds`,
`distance_meters`, `elevation_gain_meters`, `average_speed_ms`,
`is_manual`, `is_trainer`, `is_flagged`, `raw_hash`, `imported_at`.
Unicité sur (`provider`, `provider_activity_id`).

**`challenges`** — le cœur du moteur (décision D2).
`id`, `edition_id`, `day` (date), `title`, `description`, `evaluator`
(`distance` | `duration` | `elevation` | `streak` | `multisport` | `collective` |
`surprise`), `config` (jsonb), `reward_rules` (jsonb), `scope` (`all` | `team`),
`scope_ref`, `status` (`draft` | `scheduled` | `published` | `closed`),
`published_at`, `points`.

Exemple de `config` pour un défi de distance :
```json
{ "min_distance_meters": 5000, "sport_types": ["run", "trail_run"], "window": "day" }
```
Exemple de `reward_rules` :
```json
{ "cards": 1, "rarity_weights": { "commune": 70, "rare": 25, "epique": 5 } }
```

**`challenge_results`** — le résultat par participant.
`id`, `challenge_id`, `profile_id`, `status` (`pending` | `succeeded` | `failed` |
`manual_override`), `progress` (jsonb), `points_awarded`, `evaluated_at`,
`overridden_by`, `override_reason`.
Unicité sur (`challenge_id`, `profile_id`).

**`cards`** / **`card_grants`**
`cards` : `id`, `edition_id`, `code`, `name`, `description`, `rarity`
(`commune` | `rare` | `epique` | `legendaire` | `mythique`), `image_path`, `series`,
`is_active`, `released_at`.
`card_grants` : `id`, `profile_id`, `card_id`, `source` (`challenge` | `pack` |
`tier_bonus` | `admin`), `source_ref`, `granted_at`.

**`packs`** / **`pack_purchases`**
`packs` : `id`, `edition_id`, `name`, `price_cents`, `card_count`, `composition_rules`
(jsonb), `is_active`.
`pack_purchases` : `id`, `profile_id`, `pack_id`, `payment_id`, `opened_at`.

**`push_subscriptions`**
`id`, `profile_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`,
`last_success_at`, `failure_count`.

**`notification_preferences`**
`profile_id`, `channel_push`, `channel_email`, et un indicateur par catégorie
(défi du jour, résultat, carte, annonce, relance).

**`consents`** — traçabilité RGPD.
`id`, `profile_id`, `purpose` (`activity_data` | `cgv` | `marketing`), `granted`,
`granted_at`, `revoked_at`, `policy_version`, `ip_hash`.

**`shipping_addresses`** — médailles des niveaux 2 et 3 (FR16).
`id`, `profile_id`, `edition_id`, `full_name`, `line1`, `line2`, `postal_code`, `city`,
`country`, `collected_at`, `exported_at`.
*Table à durée de vie courte : purgée après l'expédition (section 8.4).*

**`flagged_activities`** — file d'arbitrage (décision D10).
`id`, `activity_id`, `profile_id`, `rules_triggered` (jsonb), `status` (`pending` |
`accepted` | `rejected`), `reviewed_by`, `reviewed_at`, `notes`.

**`news_posts`**
`id`, `edition_id`, `author_id`, `title`, `body`, `image_path`, `kind` (`admin` |
`auto`), `published_at`, `is_pinned`.

**`admin_audit_log`**
`id`, `admin_id`, `action`, `target_table`, `target_id`, `payload` (jsonb),
`created_at`.

**`leaderboard_entries`** — vue matérialisée, rafraîchie périodiquement.
`profile_id`, `edition_id`, `team_id`, `challenges_succeeded`, `points`,
`total_distance_meters`, `total_duration_seconds`, `rank_individual`, `rank_team`,
`computed_at`.

> Un classement recalculé à chaque affichage pour 800 participants serait coûteux et
> instable. Une vue matérialisée rafraîchie toutes les quinze minutes rend l'affichage
> instantané, et un décalage de quelques minutes est sans importance dans un jeu qui dure
> un mois.

### 4.3 Sécurité au niveau des lignes (RLS)

La sécurité vit dans la base, pas seulement dans le code (NFR9). Une erreur de page ne
peut donc pas exposer les données d'un autre participant.

| Table | Règle |
| --- | --- |
| `profiles` | Chacun lit et modifie le sien ; le pseudonyme et l'avatar sont lisibles par les participants de l'édition ; les administrateurs lisent tout |
| `activities`, `activity_connections` | **Strictement privé au propriétaire.** Aucune lecture croisée, y compris entre participants |
| `challenge_results` | Chacun lit le sien ; les agrégats publics passent par la vue de classement |
| `card_grants` | Chacun lit le sien |
| `payments`, `stripe_events` | Administrateurs uniquement |
| `shipping_addresses` | Le propriétaire et les administrateurs |
| `consents` | Le propriétaire en lecture ; écriture par le serveur uniquement |
| `challenges`, `cards`, `news_posts` | Lecture publique si publié ; écriture administrateur |
| `teams`, `team_members` | Lecture par les participants de l'édition ; écriture encadrée |
| `flagged_activities`, `admin_audit_log` | Administrateurs uniquement |

**Règle absolue :** la clé de service Supabase n'est utilisée que dans les traitements
serveur (webhooks, tâches planifiées) et n'est **jamais** exposée au navigateur (NFR13).

---

## 5. Intégrations externes

### 5.1 Strava

**Autorisation.** OAuth 2.0. Le participant est redirigé vers Strava, autorise
l'application, et revient avec un code que le serveur échange contre un jeton.

**Portée demandée : `activity:read_all`.** Ce choix mérite d'être expliqué. La portée
plus restreinte `activity:read` ne donne pas accès aux activités que le participant a
marquées comme privées sur Strava. Un participant qui protège ses sorties verrait ses
défis échouer sans comprendre pourquoi, et nous n'aurions aucun moyen de le lui dire.
Nous demandons donc l'accès complet, avec un **consentement explicite et séparé**, et
nous compensons par une minimisation stricte à la réception (décision D9) : nous avons le
droit de lire beaucoup, nous ne conservons presque rien.

**Jetons.** Le jeton d'accès expire après quelques heures ; un jeton de rafraîchissement
permet d'en obtenir un nouveau. Les deux sont **chiffrés en base**. Une tâche planifiée
rafraîchit les jetons avant expiration ; un échec passe la connexion en `expired` et
déclenche une notification invitant le participant à se reconnecter (FR32).

**Réception des activités.** Une souscription webhook unique au niveau de l'application.
À chaque événement, le serveur répond immédiatement puis traite en tâche de fond : il
récupère le détail de l'activité, la normalise, la minimise, l'enregistre, puis déclenche
la réévaluation des défis du jour concerné.

**Quotas.** L'API Strava impose des limites d'appels par tranche de quinze minutes et par
jour. Toutes les requêtes passent par une **file d'attente avec limitation de débit et
reprise progressive en cas de dépassement**. Cette conception rend le système correct
quel que soit le quota exact accordé — un point à vérifier au moment de la demande.

**Comportement en cas de panne (NFR7).** Les événements non traités restent en file. La
tâche de rattrapage horaire reprend les activités manquantes dès le rétablissement.
Pendant l'interruption, l'application reste consultable, affiche un bandeau explicite, et
les défis concernés restent évaluables rétroactivement.

> ⚠️ **Deux points bloquants hors de notre contrôle.** Le quota d'athlètes d'une
> application Strava nouvellement créée doit être relevé par Strava, sur demande et avec
> un délai non maîtrisé. Et l'usage prévu — classements entre participants à partir de
> données Strava — doit être confirmé conforme au contrat développeur. **Aucune décision
> technique de ce document ne peut lever ces deux risques.**

### 5.2 Stripe

**Encaissement.** Une session Checkout est créée côté serveur avec le niveau choisi. Le
montant et le libellé proviennent de `registration_tiers`, jamais du navigateur — sans
quoi un utilisateur pourrait modifier le prix.

**Webhooks écoutés.** `checkout.session.completed` (activation de l'inscription ou
attribution du pack), `charge.refunded` (remboursement), `payment_intent.payment_failed`
(échec).

**Idempotence (NFR16).** L'identifiant de l'événement Stripe est la clé primaire de
`stripe_events`. Un événement rejoué est détecté et ignoré. Le traitement s'exécute dans
une transaction unique.

**Comptabilité (NFR15).** Après confirmation, le serveur récupère la transaction de
solde Stripe pour connaître les **frais réels** — et non une estimation. Chaque ligne de
`payments` porte donc le brut, les frais, le net, la part reversée et la part de
contrepartie, rapprochables un à un avec le relevé Stripe.

**Remboursements.** Déclenchés depuis le back-office ; le webhook met à jour la ligne
d'origine sans jamais la supprimer, et l'inscription passe en `refunded`.

### 5.3 Web Push

Clés VAPID générées une fois et stockées en variables d'environnement. Le service worker
reçoit les notifications ; l'abonnement est enregistré dans `push_subscriptions`. Les
envois en masse (800 destinataires) sont découpés en lots, et un point de terminaison
définitivement en échec est désactivé automatiquement.

### 5.4 Resend (e-mails)

E-mails transactionnels (confirmation d'inscription, réinitialisation de mot de passe,
export de données) et repli des notifications essentielles. Domaine d'expédition
authentifié (SPF, DKIM) pour éviter le classement en indésirable — point à préparer bien
avant l'ouverture des inscriptions.

---

## 6. Parcours techniques principaux

### 6.1 Inscription et paiement

```
Visiteur → choisit un niveau → accepte CGV + mention « pas de reçu fiscal »
   └→ serveur : crée une session Stripe Checkout (montant lu en base)
       └→ Stripe : page de paiement hébergée
           ├→ succès → retour vers /inscription/confirmation (page d'attente)
           └→ WEBHOOK checkout.session.completed  ◄── SEULE SOURCE DE VÉRITÉ
                └→ transaction :
                     1. enregistre l'événement (idempotence)
                     2. crée le compte si absent, envoie le lien de définition du mot de passe
                     3. crée registrations (status = active)
                     4. récupère les frais réels et crée la ligne payments
                     5. attribue les packs bonus si niveau 3
                     6. envoie l'e-mail de confirmation
                     7. met à jour les compteurs publics
```

La page de confirmation attend l'activation par interrogation courte : si le webhook
tarde, l'utilisateur voit un message rassurant plutôt qu'une erreur.

### 6.2 Connexion Strava

```
Participant → consentement explicite « données d'activité » (enregistré dans consents)
   └→ redirection vers Strava (scope activity:read_all)
       └→ retour avec un code + vérification de l'état anti-CSRF
           └→ serveur : échange le code contre les jetons
                ├→ vérifie qu'aucun autre compte n'utilise ce compte Strava
                ├→ chiffre et enregistre les jetons
                ├→ importe les activités depuis le début de l'édition
                └→ évalue rétroactivement les défis déjà publiés
```

### 6.3 Réception d'une activité et évaluation d'un défi

```
Strava → WEBHOOK (activity create/update)
   └→ réponse immédiate 200, mise en file
       └→ traitement :
            1. retrouve la connexion par identifiant d'athlète
            2. rafraîchit le jeton si nécessaire
            3. récupère le détail de l'activité
            4. NORMALISE (couche D3) et MINIMISE (décision D9)
            5. enregistre dans activities (ignore si déjà connue)
            6. contrôles anti-triche → signale si nécessaire (D10)
            7. identifie les défis actifs du jour
            8. exécute l'évaluateur de chaque défi
            9. si réussi → attribue les cartes selon reward_rules
           10. notifie (push ou e-mail)
           11. marque le classement à recalculer
```

**Le tirage des cartes est transactionnel.** Une erreur en cours ne peut pas laisser un
participant avec un défi validé sans carte, ou une carte attribuée deux fois.

### 6.4 Publication du défi du jour

```
pg_cron (chaque jour à 6h00, heure de Paris)
   └→ appelle /api/cron/publish-challenge (protégée par secret partagé)
        ├→ passe le défi du jour en « published »
        ├→ envoie la notification push à tous les abonnés
        ├→ envoie l'e-mail de repli aux non-abonnés
        └→ publie une entrée dans le fil d'actualité
```

Si l'administrateur n'a rien programmé pour la journée, aucun défi n'est publié et une
**alerte est envoyée aux administrateurs** — un jour sans défi est un incident, pas un
silence.

---

## 7. Organisation du code

```
/
├── src/
│   ├── app/
│   │   ├── (public)/          # accueil, tarifs, classements publics, CGV
│   │   ├── (participant)/     # espace de jeu, protégé
│   │   ├── (admin)/           # back-office, protégé et réservé au rôle admin
│   │   └── api/
│   │       ├── webhooks/      # stripe, strava
│   │       └── cron/          # points d'entrée des tâches planifiées
│   ├── components/            # ui/, game/, admin/, marketing/
│   ├── lib/
│   │   ├── activity-sources/  # ← couche d'abstraction (D3)
│   │   │   ├── provider.ts    #   interface ActivityProvider
│   │   │   ├── strava/
│   │   │   └── normalize.ts
│   │   ├── challenges/        # ← moteur de défis (D2)
│   │   │   ├── evaluators/    #   distance, duration, elevation, streak…
│   │   │   ├── registry.ts
│   │   │   └── schemas.ts     #   validation Zod des configurations
│   │   ├── cards/             # tirage et attribution
│   │   ├── payments/          # stripe, comptabilité
│   │   ├── notifications/     # push, e-mail, ciblage
│   │   ├── antifraud/         # règles de cohérence
│   │   ├── supabase/          # clients navigateur / serveur / admin
│   │   └── crypto/            # chiffrement des jetons
│   ├── types/                 # types générés depuis le schéma de base
│   └── styles/
├── supabase/
│   ├── migrations/            # schéma versionné, y compris pg_cron
│   └── seed/                  # jeu de données de démonstration
├── public/
│   ├── manifest.json          # manifeste PWA
│   └── cards/                 # visuels fournis par le PO
├── tests/                     # unit/, e2e/
├── docs/                      # brief, prd, architecture, epics, stories
└── .github/workflows/
```

**Le fichier le plus important du dépôt est `src/lib/challenges/registry.ts`.** C'est lui
qui relie le champ `evaluator` d'une ligne de la base à la fonction qui l'évalue. Ajouter
un type de défi consiste à écrire un évaluateur et à l'y inscrire.

---

## 8. Sécurité et conformité

### 8.1 Sécurité applicative

| Sujet | Mesure |
| --- | --- |
| Secrets | Uniquement en variables d'environnement ; `.env` ignoré par git ; seul `.env.example` versionné (NFR8) |
| Clé de service Supabase | Serveur uniquement, jamais dans un composant client (NFR13) |
| Jetons Strava | Chiffrés en base avec une clé dédiée ; jamais renvoyés au navigateur |
| Webhooks | Signature vérifiée systématiquement (Stripe et Strava) avant tout traitement |
| Tâches planifiées | Routes protégées par un secret partagé, refus sinon |
| Accès aux données | Row Level Security sur toutes les tables utilisateur (NFR9) |
| Rôle administrateur | Vérifié côté serveur **et** par RLS — jamais par l'interface seule |
| Prix | Toujours lus en base, jamais transmis par le navigateur |
| Entrées | Validées par Zod à chaque frontière, y compris la configuration des défis |
| En-têtes HTTP | CSP, HSTS, protection contre l'inclusion en cadre |
| Limitation de débit | Sur l'authentification, la création de paiement et les points publics |
| Journalisation | Actions administratives tracées (`admin_audit_log`, FR94) |

### 8.2 Base légale des traitements (RGPD)

| Traitement | Base légale |
| --- | --- |
| Compte et participation au jeu | Exécution du contrat |
| Encaissement et comptabilité | Obligation légale |
| **Données d'activité sportive** | **Consentement explicite, distinct et révocable** |
| Notifications de jeu | Exécution du contrat |
| Relances et communications | Consentement |

Les données d'activité relèvent des données de santé au sens de l'article 9 du RGPD. Le
consentement est donc **explicite, séparé de l'acceptation des CGV**, recueilli **avant**
la connexion Strava, et tracé dans `consents` avec la version de la politique en vigueur.

### 8.3 Droits des personnes

| Droit | Mise en œuvre |
| --- | --- |
| Accès et portabilité | Export complet en JSON depuis le profil (FR24) |
| Effacement | Suppression du compte : purge des données, révocation du jeton Strava auprès de Strava, anonymisation des lignes comptables (conservées pour obligation légale) (FR25) |
| Rectification | Modification du profil |
| Opposition | Désactivation des notifications par catégorie (FR26) |
| Retrait du consentement | Déconnexion de Strava sans supprimer le compte (FR27) |

**Point d'attention.** Les lignes de `payments` ne peuvent pas être supprimées : la
comptabilité associative impose leur conservation. Elles sont **anonymisées** — le lien
vers le profil est rompu, le montant et la date subsistent. Ce point doit figurer
explicitement dans la politique de confidentialité.

### 8.4 Durées de conservation

| Donnée | Durée | Justification |
| --- | --- | --- |
| Activités sportives | **12 mois après la fin de l'édition**, puis suppression | Permet la comparaison d'une édition à l'autre ; au-delà, sans objet — *à valider (point P10 du PRD)* |
| Jetons Strava | Révoqués à la clôture de l'édition | Aucune raison de conserver un accès après le jeu |
| Adresses de livraison | **Purgées 3 mois après l'expédition** | Finalité épuisée |
| Comptes participants | Jusqu'à suppression par l'utilisateur ou 3 ans d'inactivité | Réutilisation d'une édition à l'autre |
| Lignes comptables | 10 ans, anonymisées | Obligation légale |
| Journaux techniques | 30 jours | Diagnostic |

### 8.5 Sous-traitants

| Sous-traitant | Rôle | Localisation |
| --- | --- | --- |
| Supabase | Base de données, authentification, fichiers | Francfort (UE) |
| Vercel | Hébergement applicatif | Région UE |
| Stripe | Paiement | UE (Irlande) |
| Strava | Source des activités | États-Unis — encadré par le consentement explicite |
| Resend | Envoi d'e-mails | UE |
| Sentry | Erreurs techniques | UE, sans données personnelles |

Un **registre des traitements** doit être tenu par l'association. Ce tableau en constitue
la base.

---

## 9. Déploiement et intégration continue

### 9.1 Environnements

| Environnement | Usage | Base | Stripe | Strava |
| --- | --- | --- | --- | --- |
| Local | Développement | Supabase local | mode test | application de test |
| Préproduction | Vérification avant fusion | projet Supabase dédié | mode test | application de test |
| Production | Le jeu réel | projet Supabase de production | mode réel | application de production |

Chaque pull request génère automatiquement un **aperçu déployé** : le PO peut voir le
résultat sur son téléphone avant de valider, sans rien installer. C'est ce qui rend le
circuit de validation tenable pour un PO non développeur.

### 9.2 Chaîne d'intégration

```
Pull request
  └→ GitHub Actions : format, typage, tests unitaires, build
  └→ Vercel : déploiement d'aperçu (URL unique)
       └→ validation du PO
            └→ squash merge dans main
                 └→ migrations de base appliquées
                 └→ déploiement en production
```

**Les migrations sont versionnées dans le dépôt** et appliquées avant le déploiement. Une
modification de schéma faite à la main dans l'interface Supabase serait perdue au
déploiement suivant : c'est interdit par convention.

### 9.3 Sauvegardes

Sauvegardes quotidiennes automatiques à partir de l'offre Supabase Pro, activée en
octobre (NFR17). En complément, un export hebdomadaire est déposé hors plateforme pendant
tout novembre. **Perdre la base pendant le jeu serait irrattrapable** : les activités
Strava peuvent être réimportées, mais pas les cartes attribuées ni les défis validés.

---

## 10. Stratégie de test

Conformément au PRD (section 6.3) : tests unitaires et d'intégration sur les parcours
critiques, vérification manuelle guidée pour le reste. Une pyramide complète n'est pas
soutenable en huit semaines.

| Domaine | Type | Priorité |
| --- | --- | --- |
| Évaluateurs de défis | Unitaire, chaque type avec ses cas limites | **Critique** |
| Tirage et attribution des cartes | Unitaire, y compris les probabilités de rareté | **Critique** |
| Webhook Stripe | Intégration, avec rejeu et idempotence | **Critique** |
| Calcul comptable (brut/frais/net/reversé) | Unitaire | **Critique** |
| Normalisation des activités Strava | Unitaire sur charges utiles réelles | **Critique** |
| Rafraîchissement des jetons | Intégration | Élevée |
| Règles RLS | Intégration : un participant ne doit jamais lire les données d'un autre | **Critique** |
| **Absence d'effet des cartes sur le classement (D8)** | Unitaire dédié | **Critique** |
| Parcours inscription → paiement → Strava → défi | Bout en bout (Playwright) | Élevée |
| Back-office : créer et publier un défi | Bout en bout | Élevée |
| Envoi des notifications | Intégration avec simulation | Moyenne |

**Répétition générale.** Une semaine avant l'ouverture des inscriptions, une édition de
test complète est jouée sur la préproduction avec un mois compressé en une journée :
inscriptions, connexions Strava, publication de défis, attribution de cartes, export
comptable. C'est le seul moyen de découvrir en octobre ce qu'on découvrirait sinon le
2 novembre.

---

## 11. Conventions de développement

**Règles impératives.**

1. Aucun montant ne provient du navigateur — toujours lu en base.
2. Aucun secret côté client ; la clé de service ne quitte jamais le serveur.
3. Aucune requête de classement ne lit `card_grants` (décision D8).
4. Aucune donnée de tracé GPS ou de fréquence cardiaque n'est enregistrée (décision D9).
5. Tout accès à la base passe par RLS ; l'usage de la clé de service est justifié au cas
   par cas.
6. Aucun défi ni carte codé en dur : toujours une ligne de base de données.
7. Tout webhook vérifie sa signature avant de traiter.
8. Toute écriture comptable est idempotente.
9. Le code, les noms et les commentaires techniques sont en anglais ; l'interface et la
   documentation métier sont en français.

**Nommage.**

| Élément | Convention | Exemple |
| --- | --- | --- |
| Tables et colonnes | `snake_case` | `challenge_results` |
| Composants React | `PascalCase` | `ChallengeCard.tsx` |
| Fonctions et variables | `camelCase` | `evaluateChallenge` |
| Routes | `kebab-case` | `/mon-album` |
| Variables d'environnement | `SCREAMING_SNAKE_CASE` | `STRAVA_CLIENT_SECRET` |

---

## 12. Coût d'exploitation

### 12.1 Coût mensuel estimé

| Poste | Développement (août-sept.) | Édition (oct.-déc.) | Remarque |
| --- | --- | --- | --- |
| Vercel | 0 € (offre Hobby) | **~19 €** (offre Pro) | *Voir la réserve ci-dessous* |
| Supabase | 0 € (offre gratuite) | **~23 €** (offre Pro) | Nécessaire pour les sauvegardes quotidiennes (NFR17) |
| Resend | 0 € | **0 à 18 €** | Gratuit jusqu'à quelques milliers d'e-mails ; payant si le repli est très sollicité |
| Nom de domaine | ~12 €/an | — | |
| Sentry | 0 € | 0 € | Offre gratuite suffisante |
| Web Push | 0 € | 0 € | Standard, sans service tiers |
| **Total mensuel** | **~0 €** | **~42 €** | |

**Total pour l'édition : environ 130 € sur trois mois**, plus le domaine. Soit **1,3 %
d'une collecte de 10 000 €**.

**Frais Stripe**, distincts de l'infrastructure : de l'ordre de 1,5 % + 0,25 € par
transaction, soit environ **450 €** pour 600 inscriptions et quelques packs. C'est le
premier poste de coût du projet, et il est incompressible.

### 12.2 Réserve sur l'offre Vercel

L'offre gratuite de Vercel est réservée à un usage personnel non commercial. Un site
associatif qui encaisse des paiements se situe dans une zone grise. **Recommandation :
budgéter l'offre Pro par précaution**, ou interroger Vercel avant octobre. Le risque à ne
rien faire — une suspension du site pendant novembre — est sans commune mesure avec les
19 € mensuels.

### 12.3 Écart avec l'objectif du PRD

Le PRD fixait un plafond de 30 € par mois (NFR6). J'arrive à 42 € sur les trois mois de
l'édition, et 0 € le reste de l'année — soit **une moyenne annuelle d'environ 11 € par
mois**, largement sous l'objectif.

Le dépassement ponctuel vient de deux postes que je ne recommande pas de sacrifier :

- **Les sauvegardes quotidiennes** (23 €). Économiser cette somme, c'est accepter de
  perdre le jeu en cours de mois sans possibilité de restauration.
- **L'offre Vercel Pro** (19 €). Économiser cette somme, c'est accepter un risque de
  suspension pendant l'édition.

Si le PO souhaite malgré tout rester sous 30 €, l'arbitrage possible est de conserver
l'offre Vercel gratuite après confirmation écrite de Vercel, ce qui ramène le total à
~23 € par mois. **Je ne recommande pas de renoncer aux sauvegardes.**

---

## 13. Risques techniques

| # | Risque | Gravité | Réponse architecturale |
| --- | --- | --- | --- |
| T1 | Usage Strava non conforme au contrat développeur | 🔴 Critique | **Aucune réponse technique possible.** La couche d'abstraction D3 limite le coût d'un ajustement, mais la vérification doit être faite auprès de Strava sans délai |
| T2 | Quota d'athlètes Strava non relevé à temps | 🔴 Critique | Aucune réponse technique. Demande à engager immédiatement |
| T3 | Compte Stripe non validé à la mi-octobre | 🔴 Critique | Aucune réponse technique. Développement possible en mode test entre-temps |
| T4 | Dépassement du quota d'appels Strava | 🟠 Élevé | File d'attente avec limitation de débit et reprise progressive ; webhooks plutôt qu'interrogation (D4) |
| T5 | Taux d'installation de la PWA insuffisant sur iPhone | 🟠 Élevé | Installation intégrée au parcours d'inscription, repli e-mail systématique (D6) |
| T6 | Perte de données pendant le jeu | 🟠 Élevé | Sauvegardes quotidiennes + export hebdomadaire hors plateforme |
| T7 | Webhook Stripe manqué ou rejoué | 🟡 Moyen | Idempotence par identifiant d'événement, réconciliation périodique avec Stripe (D5) |
| T8 | Évaluateur de défi erroné publié en cours de mois | 🟡 Moyen | Prévisualisation avant publication (FR95), validation Zod de la configuration, arbitrage manuel possible (FR48) |
| T9 | E-mails de repli classés en indésirable | 🟡 Moyen | Domaine authentifié SPF/DKIM, à préparer dès septembre |
| T10 | Deux comptes de jeu sur un même compte Strava | 🟡 Moyen | Contrainte d'unicité en base sur l'identifiant d'athlète |
| T11 | Pic de charge à la publication du défi | 🟢 Faible | Envoi des notifications par lots, classements en vue matérialisée |
| T12 | Visuels des cartes livrés tardivement | 🟡 Moyen | Visuels de remplacement en développement ; l'album fonctionne indépendamment des images définitives |

---

## 14. Points à trancher par le PO

| # | Question | Recommandation | Échéance |
| --- | --- | --- | --- |
| A1 | Offre Vercel Pro (~19 €/mois sur 3 mois) ou vérification préalable de l'éligibilité à l'offre gratuite ? | Budgéter Pro | Avant octobre |
| A2 | Offre Supabase Pro (~23 €/mois sur 3 mois) pour les sauvegardes quotidiennes ? | **Oui, sans réserve** | Avant octobre |
| A3 | Portée Strava `activity:read_all` (inclut les activités privées) ? | Oui, avec consentement explicite et minimisation | Phase 4 |
| A4 | Durée de conservation des activités après l'édition (point P10 du PRD) | 12 mois | Phase 4 |
| A5 | Traitement des activités saisies à la main sur Strava (point P11 du PRD) | Exclues ; les imports depuis une montre restent acceptés | Phase 4 |
| A6 | Nom de domaine de l'édition | À choisir et réserver rapidement | Août |
| A7 | Compte Sentry pour la remontée des erreurs | Oui, offre gratuite | Phase 4 |

---

## 15. Prochaines étapes

### 15.1 Actions hors développement, sur le chemin critique

1. **Créer l'application Strava et engager la demande de relèvement de quota** (T2).
2. **Faire confirmer par Strava la conformité de l'usage prévu** (T1).
3. **Ouvrir et faire valider le compte Stripe de l'association** (T3).
4. **Réserver le nom de domaine** (A6).
5. **Obtenir un devis ferme de médaille** — conditionne la grille de dons (point P1 du PRD).

### 15.2 Passation au PO et au Scrum Master (Phase 4)

Le découpage en epics et stories doit respecter les principes suivants :

- **L'epic 1 doit livrer un squelette réellement déployé** : projet, intégration
  continue, PWA installable, authentification, page d'accueil aux couleurs du jeu. Pas
  seulement configuré — visible sur un téléphone.
- **Le moteur de défis (D2) est le cœur technique.** Il doit être découpé de façon à
  livrer d'abord un seul type d'évaluateur de bout en bout — de la création dans le
  back-office à la carte attribuée — avant d'ajouter les six autres.
- **La couche « source d'activité » (D3) doit exister dès la première story Strava**,
  jamais ajoutée après coup.
- **La sécurité au niveau des lignes s'écrit avec chaque table**, jamais dans une story
  de fin de projet.
- **L'epic 3 (Strava) porte un risque externe** : prévoir un jeu de données d'activités
  simulées permettant de développer et de tester les epics 4 et 5 **sans dépendre du
  déblocage du quota Strava**. C'est la seule protection possible contre T2.
- Chaque story doit être réalisable en une session de travail focalisée, sans dépendre
  d'une story ultérieure.
