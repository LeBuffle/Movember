# DEFI Movember — Document d'Architecture

| | |
| --- | --- |
| **Version** | v1.1 — Phase 3 BMAD (Architect) |
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
| 2026-08-03 | v1.1 | **Hébergement sur VPS Hostinger** décidé par le PO (remplace Vercel) : déploiement, tâches planifiées, sauvegardes, supervision, coûts et risques révisés. Modèle de données étendu aux règles de jeu précisées par le PO (défis individualisés, classements multiples, raretés commune/rare/épique/légendaire) | Agent Architect |

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
comptes, Stripe pour les paiements, Strava pour les activités sportives, et **ton VPS
Hostinger pour l'hébergement**. Ce sont les mêmes outils que sur tes autres projets.

**Note sur l'hébergement.** La première version de ce document recommandait Vercel. Tu as
choisi le VPS Hostinger : c'est ta décision et je l'applique. C'est **moins cher** — le
serveur est déjà payé — et ça **règle la question juridique** de l'offre Vercel gratuite
pour un site qui encaisse de l'argent. En contrepartie, il faut construire le déploiement
(environ une journée de travail) et **quelqu'un doit pouvoir relever le serveur s'il
tombe en novembre**. J'ai prévu ce qu'il faut pour que ça n'arrive presque jamais et que
ce soit simple à traiter si ça arrive : redémarrage automatique, surveillance, alerte, et
une procédure écrite. Le détail est en section 9.6.

**Le point le plus important du document.** Les défis et les cartes ne sont **pas écrits
dans le code**. Ils sont enregistrés dans la base de données comme des fiches. Créer un
défi ou une carte en plein mois de novembre, c'est remplir un formulaire dans le
back-office — pas me demander de modifier le programme. C'est ce qui rend la promesse de
la refonte tenable, et ça conditionne une bonne partie des choix techniques qui suivent.

**Ce que ça va coûter.** Le VPS est déjà payé, donc le seul vrai surcoût est Supabase
Pro. Environ **25 € par mois d'octobre à décembre**, soit **environ 75 € pour toute
l'édition** — moins de 1 % d'une collecte de 10 000 €, et **sous l'objectif de 30 € par
mois du PRD**. Le passage au VPS a fait économiser une vingtaine d'euros par mois. Le
détail est en section 12.

**Un point de vigilance sur les frais Stripe.** Ils représenteront environ **450 €** pour
600 inscriptions — soit six fois le coût technique du projet. C'est le premier poste de
dépense et il est incompressible.

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

Application **Next.js (App Router, TypeScript)** conteneurisée avec **Docker** et
déployée sur un **VPS Hostinger**, derrière un reverse proxy **Caddy** qui gère les
certificats HTTPS automatiquement. La base de données, l'authentification et le stockage
des fichiers restent chez **Supabase** (PostgreSQL managé, sécurité au niveau des
lignes). L'application sert les trois parcours — public, participant, administrateur —
depuis un même dépôt et un même déploiement.

Les traitements de fond (synchronisation Strava, évaluation des défis, envoi des
notifications, calcul des classements) sont déclenchés par **événements** — un webhook
Strava, un webhook Stripe — ou par **tâches planifiées** exécutées par le cron système du
VPS. Le contenu du jeu (défis, cartes, règles de tirage, seuils anti-triche) est **stocké
en base de données**, jamais codé en dur.

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
│                      VPS HOSTINGER (Docker)                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ CADDY — reverse proxy, HTTPS automatique, en-têtes sécurité    │  │
│  └───────────────┬──────────────────────────┬─────────────────────┘  │
│  ┌───────────────▼──────────────┐ ┌─────────▼────────────────────┐   │
│  │ app  (Next.js standalone)    │ │ app-staging (préproduction)  │   │
│  │ rendu · webhooks · API       │ │ staging.<domaine>            │   │
│  └───────────────┬──────────────┘ └──────────────────────────────┘   │
│  ┌───────────────▼──────────────┐ ┌──────────────────────────────┐   │
│  │ worker — file de traitement  │ │ cron système                 │   │
│  │ Strava, push, e-mails        │ │ défi du jour, rattrapage,    │   │
│  └──────────────────────────────┘ │ classements, sauvegardes     │   │
│                                    └──────────────────────────────┘   │
└───┬───────────────────┬──────────────────┬───────────────────┬───────┘
    │                   │                  │                   │
┌───▼────────────┐ ┌────▼──────┐ ┌─────────▼────────┐ ┌────────▼──────┐
│   SUPABASE     │ │  STRIPE   │ │      STRAVA      │ │   RESEND      │
│ (Frankfurt)    │ │           │ │                  │ │  (e-mails)    │
│ • PostgreSQL   │ │ Checkout  │ │ OAuth 2.0        │ │               │
│ • Auth         │ │ Webhooks  │ │ Webhooks         │ │               │
│ • Storage      │ │ Refunds   │ │ API activités    │ │               │
│ • RLS          │ │           │ │                  │ │               │
└────────────────┘ └───────────┘ └──────────────────┘ └───────────────┘
```

### 2.3 Choix de plateforme

**Retenu, sur décision du PO : VPS Hostinger + Supabase managé.**

| Critère | VPS Hostinger (retenu) | Vercel | AWS |
| --- | --- | --- | --- |
| Coût mensuel additionnel | 0 € — serveur déjà payé | ~19 € | 15-40 €, imprévisible |
| Temps de mise en route | ~1 journée | quelques heures | 1 semaine+ |
| Maintenance système | à notre charge | nulle | partielle |
| Déploiement continu | à construire | inclus | à construire |
| Aperçus automatiques par pull request | non — préproduction permanente à la place | inclus | non |
| Question juridique sur l'usage commercial | aucune | offre gratuite ambiguë | aucune |
| Montée en charge | manuelle (sans objet à 800 utilisateurs) | automatique | automatique |
| Point de panne unique | oui | non | non |

**Pourquoi ce choix se défend.** Le serveur est déjà payé, ce qui ramène le coût
additionnel d'hébergement à zéro et fait passer le projet **sous le plafond de 30 € par
mois du PRD**. Il lève aussi une ambiguïté réelle : l'offre gratuite de Vercel est
réservée à un usage non commercial, et un site qui encaisse des paiements s'y situe en
zone grise. Enfin, à 800 utilisateurs, aucune des capacités de mise à l'échelle de Vercel
n'est nécessaire — un VPS modeste absorbe cette charge sans difficulté.

**Ce que ce choix coûte, et comment on le compense.**

| Ce qu'on perd | Compensation retenue |
| --- | --- |
| Les aperçus déployés automatiquement à chaque pull request | Une **préproduction permanente** sur `staging.<domaine>`, redéployée automatiquement à chaque push sur la branche de travail. Le PO valide dessus depuis son téléphone, comme prévu |
| L'absence totale de maintenance système | Conteneurs Docker avec redémarrage automatique, mises à jour de sécurité automatisées, supervision et alerte (section 9.6) |
| La redondance | Snapshots Hostinger + sauvegardes de base hors serveur + procédure de restauration écrite et **testée avant octobre** |
| Le déploiement clé en main | Chaîne GitHub Actions → SSH → Docker, à construire une fois (~1 journée) |

**Alternative écartée : Vercel.** Recommandée dans la v1 de ce document pour sa rapidité
de mise en œuvre et l'absence de maintenance. Écartée par décision du PO au profit d'une
infrastructure déjà payée et sans ambiguïté juridique. Le compromis est explicite : on
échange environ une journée de mise en place et une charge d'exploitation résiduelle
contre une vingtaine d'euros mensuels et la maîtrise complète de l'hébergement.

**Alternative écartée : AWS.** Puissance et tarification à l'usage sans rapport avec un
projet de 800 utilisateurs ; complexité et délai de mise en œuvre rédhibitoires.

**Alternative écartée : héberger aussi PostgreSQL sur le VPS.** Économiserait les 23 €
de Supabase Pro, mais mettrait à notre charge les sauvegardes, la réplication, les
correctifs de sécurité et l'authentification — soit exactement ce qui prend du temps et
casse en production. **Garder la base chez Supabase est le bon partage :** on prend en
charge ce qui est simple et statique (servir une application web), on délègue ce qui est
critique et opérationnel (les données).

**Régions :** VPS Hostinger en Europe, Supabase à Francfort (`eu-central-1`). Toutes les
données personnelles restent dans l'Union européenne (NFR10).

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
| Conteneurisation | Docker + Docker Compose | — | Déploiement reproductible, redémarrage automatique |
| Reverse proxy | Caddy | 2.x | HTTPS et renouvellement des certificats automatiques, configuration en quelques lignes |
| Tâches planifiées | cron système du VPS | — | Disponible nativement, sans dépendance ni surcoût |
| Système | Debian ou Ubuntu LTS | — | Mises à jour de sécurité automatiques |
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

### D7 — Tâches planifiées par le cron système du VPS

**Décision.** Les traitements récurrents — publication et attribution des défis du jour,
rattrapage Strava, recalcul des classements, relance des inactifs, rafraîchissement des
jetons, sauvegardes — sont déclenchés par le **cron système du VPS**, qui appelle des
routes protégées de l'application.

**Pourquoi.** Le VPS dispose d'un cron natif, gratuit, sans limite de fréquence et sans
dépendance externe. C'est l'un des bénéfices directs du choix d'hébergement.

**Compromis accepté.** La planification vit dans un fichier de configuration du serveur
plutôt que dans le code. Elle est donc **versionnée dans le dépôt** (`deploy/crontab`) et
installée par le script de déploiement, ce qui préserve la traçabilité et évite qu'elle
diverge silencieusement.

**Alternative écartée.** `pg_cron` dans Supabase : retenu dans la v1 quand
l'hébergement était Vercel. Reste une solution de repli valable si le cron du VPS pose
problème, mais ajoute une indirection inutile maintenant qu'on dispose d'un serveur.

### D8 — Le classement des cartes ne compte que les cartes gagnées, jamais les cartes achetées

**Le problème posé.** Le PO souhaite un classement sur le nombre de cartes — secondaire,
mais présent. Or les packs sont achetables, et le niveau 3 en offre deux à l'inscription.
Un classement sur le nombre total de cartes serait donc directement achetable, ce
qu'interdit la règle « aucun avantage compétitif ne s'achète » (NFR20).

**Décision.** Le classement collection se calcule **uniquement sur les cartes obtenues
par le jeu** — tirage quotidien et défis réussis. Les cartes issues d'un **pack acheté**
ou du **bonus de niveau 3** sont exclues du calcul.

**En clair.** Acheter des packs remplit ton album et t'aide à le compléter, ce qui est
l'intérêt du pack. Mais ça ne te fait pas gagner une place au classement. Le classement
récompense ce que tu as gagné en faisant du sport.

**Traduction technique.** La colonne `card_grants.source` distingue déjà l'origine de
chaque carte. Le classement collection ne compte que `source IN ('challenge',
'daily_draw')`. Les valeurs `pack` et `tier_bonus` sont exclues.

**Deux compteurs distincts sont affichés dans l'album**, sans ambiguïté pour le joueur :
« cartes gagnées » (celle qui compte au classement) et « collection complète »
(l'ensemble, achats inclus).

**Le classement général reste purement sportif.** Il se fonde sur les points des défis
réussis (décision D14) et ne lit jamais `card_grants`. Un test automatisé vérifie les
deux règles : aucune carte achetée dans le classement collection, aucune carte du tout
dans le classement général.

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

### D13 — Chaque participant reçoit son propre défi, tiré d'un catalogue

**Décision.** L'administrateur ne crée pas « le défi du 12 novembre ». Il alimente un
**catalogue de défis**, chacun caractérisé par son type d'activité, sa difficulté et sa
durée. Chaque jour, une tâche planifiée **attribue un défi à chaque participant** en
tirant dans ce catalogue.

**Pourquoi cette conception.** Elle sert directement ce que le PO a demandé : des défis
différents d'un participant à l'autre, de difficultés variables, sur des sports variés.
Elle a un bénéfice moins évident mais décisif : **elle supprime l'obligation pour
l'organisation de produire un défi chaque matin de novembre**. Le catalogue est constitué
en octobre ; novembre se déroule tout seul, et le back-office sert à ajuster, pas à
alimenter en urgence.

**Règles d'attribution.**
- Aucun participant ne reçoit deux fois le même défi dans l'édition, tant que le
  catalogue le permet.
- L'attribution évite de donner un défi de natation à quelqu'un qui n'a jamais nagé — un
  ajustement simple fondé sur les sports déjà pratiqués, avec repli sur un défi
  polyvalent si l'historique est insuffisant.
- L'administrateur peut **forcer un défi commun à tous** pour une journée donnée : c'est
  le mécanisme des défis collectifs et des animations spéciales.

**Compromis accepté.** Un catalogue trop petit produirait des répétitions. Il faut donc
prévoir un volume suffisant — de l'ordre de plusieurs dizaines de défis pour 30 jours,
avec plusieurs variantes de difficulté par sport. C'est un travail de contenu à mener en
septembre, à signaler comme tel dans le découpage en stories.

**Alternative écartée.** Un défi unique quotidien identique pour tous : plus simple à
construire, mais exclut mécaniquement les sports que le participant ne pratique pas, et
impose à l'organisation d'être présente chaque jour.

### D14 — Le classement général se fonde sur des points, pas sur un nombre de défis

**Le problème posé.** Puisque les défis diffèrent d'un participant à l'autre et que
certains sont plus durs ou plus longs que d'autres, compter le **nombre** de défis réussis
avantagerait celui qui a tiré les défis les plus faciles.

**Décision.** Chaque défi du catalogue porte une **valeur en points** reflétant sa
difficulté et sa durée. Le classement général cumule ces points. Le nombre brut de défis
réussis reste affiché, mais comme **classement secondaire**, aux côtés des autres.

**Les classements retenus** (tous calculés sur l'édition en cours) :

| Classement | Base de calcul | Rang |
| --- | --- | --- |
| **Général** | Points des défis réussis | Principal |
| Défis réalisés | Nombre de défis réussis | Secondaire |
| Cartes gagnées | Cartes obtenues **par le jeu uniquement** (décision D8) | Secondaire |
| Kilomètres — course | Distance cumulée, activités de course | Secondaire |
| Kilomètres — vélo | Distance cumulée, activités de vélo | Secondaire |
| Nombre d'activités | Activités enregistrées sur la période | Secondaire |
| Temps d'activité | Durée cumulée, tous sports | Secondaire |
| **Équipes** | Points de l'équipe, normalisés par le nombre de membres | Principal collectif |

**Pourquoi plusieurs classements plutôt qu'un seul.** À 600 participants, un classement
unique n'intéresse que les dix premiers. Sept classements thématiques donnent à chacun
une catégorie où il peut figurer honorablement — le cycliste, l'assidu, le collectionneur,
le régulier. C'est un levier de rétention plus efficace qu'un podium unique, et le coût
technique est marginal : tous se calculent depuis les mêmes données.

**Traduction technique.** Tous les classements sont produits par une même vue
matérialisée rafraîchie périodiquement, avec une colonne de rang par catégorie. Aucun
calcul à l'affichage.

**Point à trancher avec le PO.** La difficulté d'un défi ne détermine pas la rareté de la
carte obtenue — c'est une règle explicite du PO. La seule récompense d'un défi difficile
est donc le nombre de points. **Il faut que l'écart de points soit assez marqué pour que
tenter un défi dur en vaille la peine** : un rapport de 1 à 3 entre un défi facile et un
défi difficile est un point de départ raisonnable, à ajuster.

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

**`challenges`** — le **catalogue** de défis (décisions D2 et D13). Une ligne est un défi
disponible, pas un défi daté.
`id`, `edition_id`, `title`, `description`, `evaluator`
(`distance` | `duration` | `elevation` | `streak` | `multisport` | `collective` |
`surprise`), `config` (jsonb), `sport_family` (`run` | `bike` | `swim` | `strength` |
`walk` | `any`), `difficulty` (`facile` | `moyen` | `difficile`), `points`,
`duration_scope` (`day` | `multi_day`), `duration_days`, `reward_rules` (jsonb),
`is_active`, `created_by`, `created_at`.

Exemple de `config` pour un défi de distance :
```json
{ "min_distance_meters": 5000, "sport_types": ["run", "trail_run"], "window": "day" }
```
Exemple de `reward_rules` — la carte est tirée au sort, indépendamment de la difficulté :
```json
{ "cards": 1, "draw": "random_weighted" }
```

**`challenge_assignments`** — le défi attribué à un participant pour une date donnée
(décision D13). C'est ici que vit le calendrier, pas dans `challenges`.
`id`, `edition_id`, `profile_id`, `challenge_id`, `assigned_for` (date),
`expires_on` (null si sans limite), `status` (`open` | `succeeded` | `failed` |
`manual_override`), `progress` (jsonb), `points_awarded`, `completed_at`,
`overridden_by`, `override_reason`, `created_at`.
Unicité sur (`profile_id`, `challenge_id`) — un participant ne reçoit jamais deux fois le
même défi.

> **Les défis ne se bloquent pas les uns les autres.** Un défi non réussi reste `open` et
> peut être validé plus tard ; le défi du lendemain est attribué indépendamment. Un
> participant peut donc avoir plusieurs défis ouverts simultanément, et **une seule
> activité peut en valider plusieurs d'un coup** — une sortie vélo de 30 km valide à la
> fois « 20 km à vélo » et « 1 heure d'activité ». C'est une exigence explicite du PO, et
> elle impose que l'évaluation parcoure **tous** les défis ouverts du participant à chaque
> nouvelle activité, pas seulement celui du jour.

**`cards`** / **`card_grants`**
`cards` : `id`, `edition_id`, `code`, `name`, `description`, `rarity`
(`commune` | `rare` | `epique` | `legendaire`), `image_path`, `series`
(regroupement thématique : formes, couleurs), `is_active`, `released_at`.

> Les cartes sont sur le thème de la moustache — formes, couleurs, noms fantaisistes
> (« mono moustache », « moustache girlie », « moustache fine », « moustache touffue »,
> « moustache cowboy », « moustache d'or », « moustache teinte », « moustache blanche »).
> Quatre niveaux de rareté, par ordre croissant : **commune, rare, épique, légendaire**.
>
> La rareté `legendaire` n'est garantie que par le bonus du niveau 3 ; elle reste
> accessible par le tirage des défis avec une probabilité faible. Le niveau d'inscription
> `legendaire` (« Sportif légendaire ») et la rareté `legendaire` portent le même nom mais
> vivent dans deux tables distinctes — c'est voulu et cohérent narrativement, sans
> ambiguïté technique.

`card_grants` : `id`, `profile_id`, `card_id`, `source` (`challenge` | `daily_draw` |
`pack` | `tier_bonus` | `admin`), `source_ref`, `granted_at`.

> **La colonne `source` porte l'intégrité du classement collection** (décision D8) : seules
> les valeurs `challenge` et `daily_draw` y sont comptées.

**`packs`** / **`pack_purchases`**
`packs` : `id`, `edition_id`, `name`, `price_cents`, `card_count` (**5** pour le pack
booster), `composition_rules` (jsonb : poids par rareté, garanties éventuelles),
`is_active`.
`pack_purchases` : `id`, `profile_id`, `pack_id`, `payment_id`, `source`
(`purchase` | `tier_bonus`), `opened_at`.

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

**`leaderboard_entries`** — vue matérialisée alimentant **tous** les classements
(décision D14), rafraîchie périodiquement.
`profile_id`, `edition_id`, `team_id`,
`points` · `challenges_succeeded` · `cards_earned` *(hors packs et bonus)* ·
`run_distance_meters` · `bike_distance_meters` · `activity_count` ·
`total_duration_seconds`,
puis un rang par catégorie : `rank_points`, `rank_challenges`, `rank_cards`,
`rank_run`, `rank_bike`, `rank_activities`, `rank_duration`,
et `computed_at`.

> Un classement recalculé à chaque affichage pour 800 participants serait coûteux et
> instable. Une vue matérialisée rafraîchie toutes les quinze minutes rend l'affichage
> instantané, et un décalage de quelques minutes est sans importance dans un jeu qui dure
> un mois. Les sept classements se calculent en une seule passe sur les mêmes données :
> en ajouter un de plus est quasiment gratuit.

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
            7. charge TOUS les défis encore ouverts du participant (pas seulement
               celui du jour — décision D13)
            8. exécute l'évaluateur de chacun
            9. pour chaque défi réussi → attribue une carte tirée au sort
           10. notifie (push ou e-mail), en regroupant si plusieurs défis validés
           11. marque le classement à recalculer
```

**Une activité peut valider plusieurs défis à la fois.** C'est une exigence explicite du
PO, et c'est la raison pour laquelle l'étape 7 balaie tous les défis ouverts. Si trois
défis tombent d'un coup, le participant reçoit trois cartes et **une seule notification
groupée** — trois notifications successives seraient perçues comme du bruit.

**Le tirage des cartes est transactionnel.** Une erreur en cours ne peut pas laisser un
participant avec un défi validé sans carte, ou une carte attribuée deux fois.

### 6.4 Attribution quotidienne des défis

```
cron système (chaque jour à 6h00, heure de Paris)
   └→ appelle /api/cron/assign-daily (protégée par secret partagé)
        ├→ pour chaque participant actif :
        │    ├→ si un défi commun est imposé par l'admin → l'attribuer à tous
        │    └→ sinon → tirer un défi du catalogue :
        │         • jamais déjà attribué à ce participant
        │         • cohérent avec les sports qu'il pratique
        │         • en variant la difficulté au fil des jours
        ├→ notifie chaque participant de son défi du jour (push, ou e-mail en repli)
        └→ publie une entrée dans le fil d'actualité
```

**Deux garde-fous.**

Si le catalogue est **épuisé** pour un participant — tous les défis compatibles déjà
attribués — le système bascule sur un défi générique de rattrapage et **alerte les
administrateurs**. Un participant sans défi est un incident silencieux : c'est exactement
le type de panne qu'on ne découvre que par une réclamation, donc il faut qu'elle
s'annonce.

Si le catalogue passe sous un **seuil d'alerte** (moins de dix défis inutilisés en
moyenne par participant), une alerte est envoyée pour laisser le temps de l'enrichir avant
la rupture.

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
│   ├── migrations/            # schéma versionné
│   └── seed/                  # jeu de données de démonstration
├── public/
│   ├── manifest.json          # manifeste PWA
│   └── cards/                 # visuels fournis par le PO
├── deploy/                    # ← infrastructure VPS, versionnée
│   ├── Dockerfile
│   ├── docker-compose.yml     #   caddy, app, app-staging, worker
│   ├── Caddyfile              #   HTTPS, protection de la préproduction
│   ├── crontab                #   tâches planifiées (décision D7)
│   └── scripts/               #   deploy.sh, rollback.sh, backup.sh, restore.sh
├── tests/                     # unit/, e2e/
├── docs/                      # brief, prd, architecture, epics, stories, runbook
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
| Hostinger | Hébergement applicatif (VPS) | Union européenne |
| Stripe | Paiement | UE (Irlande) |
| Strava | Source des activités | États-Unis — encadré par le consentement explicite |
| Resend | Envoi d'e-mails | UE |
| Sentry | Erreurs techniques | UE, sans données personnelles |

Un **registre des traitements** doit être tenu par l'association. Ce tableau en constitue
la base.

---

## 9. Déploiement et intégration continue

### 9.1 Environnements

| Environnement | Usage | Adresse | Base | Stripe | Strava |
| --- | --- | --- | --- | --- | --- |
| Local | Développement | `localhost` | Supabase local | mode test | application de test |
| Préproduction | Validation du PO | `staging.<domaine>` | projet Supabase dédié | mode test | application de test |
| Production | Le jeu réel | `<domaine>` | projet Supabase de production | mode réel | application de production |

Les deux environnements serveur tournent **sur le même VPS**, dans des conteneurs
distincts, avec des bases et des jeux de clés séparés. Caddy les distingue par nom de
domaine.

**La préproduction remplace les aperçus par pull request.** Elle est redéployée
automatiquement à chaque push sur la branche de travail. Le PO ouvre `staging.<domaine>`
sur son téléphone et valide ce qu'il voit, sans rien installer — c'est ce qui rend le
circuit de validation tenable pour un PO non développeur, et c'est la compensation
explicite du renoncement à Vercel.

**La préproduction n'est pas publique** : accès protégé par mot de passe au niveau du
reverse proxy, et exclusion des moteurs de recherche. Un site de test indexé qui prend des
paiements en mode test serait un problème de crédibilité.

### 9.2 Composition Docker

| Conteneur | Rôle | Redémarrage |
| --- | --- | --- |
| `caddy` | Reverse proxy, HTTPS automatique, en-têtes de sécurité, protection de la préproduction | `always` |
| `app` | Next.js en mode standalone — production | `always` |
| `app-staging` | Next.js — préproduction | `always` |
| `worker` | File de traitement : activités Strava, envois push et e-mail | `always` |

Le cron système du VPS appelle les routes planifiées de `app` (décision D7). La base de
données n'est **pas** sur le VPS : elle reste chez Supabase.

**Images.** Construites par GitHub Actions, publiées sur le registre de conteneurs GitHub,
récupérées par le VPS. Le serveur ne compile rien — il ne fait que télécharger et
redémarrer. C'est plus rapide, plus reproductible, et ça évite qu'un déploiement échoue
faute de mémoire sur un petit VPS.

### 9.3 Chaîne d'intégration et de déploiement

```
Push sur la branche de travail
  └→ GitHub Actions : format, typage, tests unitaires, build
       └→ image publiée sur le registre GitHub
            └→ SSH vers le VPS → déploiement en PRÉPRODUCTION
                 └→ validation du PO sur staging.<domaine>
                      └→ squash merge dans main
                           └→ GitHub Actions : build + image « production »
                                └→ SSH vers le VPS :
                                     1. migrations de base appliquées
                                     2. nouvelle image récupérée
                                     3. bascule des conteneurs
                                     4. contrôle de santé
                                     5. retour à la version précédente si échec
```

**L'accès SSH se fait par clé dédiée**, stockée dans les secrets GitHub, avec un
utilisateur de déploiement aux droits limités — jamais `root`.

**Retour arrière.** Les images précédentes sont conservées et étiquetées. Revenir à la
version antérieure prend moins d'une minute. C'est le filet de sécurité indispensable
quand on déploie en plein mois de novembre.

**Les migrations sont versionnées dans le dépôt** et appliquées avant la bascule. Une
modification de schéma faite à la main dans l'interface Supabase serait perdue au
déploiement suivant : c'est interdit par convention.

### 9.4 Sauvegardes

Trois niveaux, parce que perdre la base pendant le jeu serait irrattrapable — les
activités Strava peuvent être réimportées, mais **pas les cartes attribuées ni les défis
validés**.

| Niveau | Contenu | Fréquence | Emplacement |
| --- | --- | --- | --- |
| Supabase Pro | Sauvegarde complète automatique | quotidienne | Supabase (NFR17) |
| Export automatisé | `pg_dump` déclenché par le cron du VPS | quotidienne en novembre | VPS, rotation sur 14 jours |
| Copie hors site | Le même export, copié ailleurs | hebdomadaire | Stockage externe |

**La restauration doit être testée avant octobre**, pas découverte en novembre. Une
sauvegarde jamais restaurée n'est pas une sauvegarde.

### 9.5 Durcissement du serveur

Pare-feu n'ouvrant que 80, 443 et le port SSH · authentification SSH par clé uniquement,
mot de passe désactivé, connexion `root` interdite · mises à jour de sécurité automatiques
· `fail2ban` contre les tentatives répétées · conteneurs exécutés sans privilèges · aucun
secret dans les images, tous injectés à l'exécution depuis un fichier d'environnement
protégé sur le serveur.

### 9.6 Supervision et conduite à tenir en novembre

C'est la contrepartie du choix d'hébergement : personne d'autre ne surveille le serveur.

| Dispositif | Rôle |
| --- | --- |
| Contrôle de santé externe (UptimeRobot ou équivalent, offre gratuite) | Interroge le site toutes les 5 minutes, alerte par e-mail et SMS en cas d'indisponibilité |
| Redémarrage automatique des conteneurs | Un plantage applicatif se répare tout seul en quelques secondes |
| Alerte sur espace disque et mémoire | Prévient avant la saturation, pas après |
| Sentry | Remonte les erreurs applicatives en production |
| Alerte métier | Défi non attribué, catalogue épuisé, webhook Stripe en échec, connexion Strava massivement expirée |
| Snapshot Hostinger avant chaque déploiement majeur | Retour à un serveur entier en cas de problème système |

**Procédure écrite.** Un document `docs/runbook.md` sera produit en Phase 5 : comment
redémarrer l'application, restaurer une sauvegarde, revenir à la version précédente, et
que faire si le VPS ne répond plus. Il doit être compréhensible par le PO seul, un
dimanche soir de novembre. **C'est une livraison obligatoire, pas une option.**

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
| VPS Hostinger | 0 € | **0 €** | Serveur déjà payé et déjà utilisé par le PO |
| Supabase | 0 € (offre gratuite) | **~23 €** (offre Pro) | Nécessaire pour les sauvegardes quotidiennes (NFR17) |
| Resend | 0 € | **0 à 18 €** | Gratuit jusqu'à quelques milliers d'e-mails ; payant si le repli est très sollicité |
| Nom de domaine | ~12 €/an | — | À réserver |
| Sentry | 0 € | 0 € | Offre gratuite suffisante |
| Surveillance externe | 0 € | 0 € | Offre gratuite suffisante |
| Web Push | 0 € | 0 € | Standard, sans service tiers |
| **Total mensuel** | **~0 €** | **~25 €** | **Sous l'objectif du PRD** |

**Total pour l'édition : environ 75 € sur trois mois**, plus le domaine. Soit **moins de
1 % d'une collecte de 10 000 €**.

**Frais Stripe**, distincts de l'infrastructure : de l'ordre de 1,5 % + 0,25 € par
transaction, soit environ **450 €** pour 600 inscriptions et quelques packs. C'est le
premier poste de coût du projet — **six fois le coût technique** — et il est
incompressible.

### 12.2 Effet du choix d'hébergement sur le budget

Le passage de Vercel au VPS fait économiser environ **19 € par mois sur trois mois**, soit
57 € sur l'édition, et fait passer le total **sous le plafond de 30 € mensuels fixé par le
PRD** (NFR6) — objectif que la v1 de ce document ne tenait pas.

Ce n'est pas gratuit pour autant : le coût s'est déplacé de l'argent vers le **temps de
mise en place** (environ une journée pour construire la chaîne de déploiement) et vers la
**charge d'exploitation** pendant novembre. Sur un projet où le temps est la ressource la
plus rare, c'est un arbitrage à assumer consciemment — ce que le PO a fait.

**Un seul poste reste non négociable : les sauvegardes quotidiennes** (23 €). Économiser
cette somme reviendrait à accepter de perdre le jeu en cours de mois sans possibilité de
restauration. Le PO a indiqué envisager le passage à Supabase Pro : c'est la bonne
décision, et elle doit être effective **avant l'ouverture des inscriptions**, pas au
premier incident.

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
| T13 | **Le VPS tombe pendant le jeu et personne ne le relève** | 🟠 Élevé | Redémarrage automatique des conteneurs, surveillance externe avec alerte SMS, snapshots Hostinger, retour arrière en une minute, et **procédure écrite compréhensible par le PO seul** (section 9.6). C'est le risque propre au choix d'hébergement, et le seul dont la réponse repose sur une personne disponible |
| T14 | Catalogue de défis trop maigre — répétitions ou rupture | 🟠 Élevé | Alerte automatique sous seuil, défi générique de rattrapage, et **constitution du catalogue traitée comme une story à part entière en septembre** (décision D13) |
| T15 | Défaut de sécurité du serveur (accès non autorisé) | 🟡 Moyen | Durcissement décrit en section 9.5 ; aucune donnée sensible sur le VPS — la base et les comptes restent chez Supabase, ce qui limite fortement la portée d'une compromission |
| T16 | Points de défi mal calibrés — classement général perçu comme injuste | 🟡 Moyen | Points modifiables en base sans redéploiement ; recalcul complet du classement possible à tout moment (décision D14) |

---

## 14. Points à trancher par le PO

| # | Question | Recommandation | Échéance |
| --- | --- | --- | --- |
| ~~A1~~ | ~~Offre Vercel~~ | ✅ **Résolue** — hébergement sur VPS Hostinger | — |
| A2 | Offre Supabase Pro (~23 €/mois sur 3 mois) pour les sauvegardes quotidiennes | **Oui, sans réserve** — le PO l'envisage déjà ; à activer avant l'ouverture des inscriptions | Avant octobre |
| A3 | Portée Strava `activity:read_all` (inclut les activités privées) | Oui, avec consentement explicite et minimisation | Phase 4 |
| A4 | Durée de conservation des activités après l'édition (point P10 du PRD) | 12 mois | Phase 4 |
| A5 | Traitement des activités saisies à la main sur Strava (point P11 du PRD) | Exclues ; les imports depuis une montre restent acceptés | Phase 4 |
| A6 | Nom de domaine de l'édition | À réserver — le PO s'en occupe | Août |
| A7 | Compte Sentry pour la remontée des erreurs | Oui, offre gratuite | Phase 4 |
| ~~A8~~ | ~~Contradiction sur la « carte légendaire garantie »~~ | ✅ **Résolue** — raretés arrêtées à commune, rare, épique, légendaire | — |
| ~~A9~~ | ~~Une carte par défi ou une par jour ?~~ | ✅ **Résolue** — une carte **par défi réussi** | — |
| **A10** | Écart de points entre un défi facile et un défi difficile | Rapport de 1 à 3 pour commencer, ajustable en base sans redéploiement | Phase 4 |
| **A11** | Volume cible du catalogue de défis | Au moins 60 à 80 défis répartis sur les sports et les difficultés, à produire en septembre | Septembre |
| **A12** | Probabilités de tirage par rareté | Point de départ : commune 60 %, rare 28 %, épique 10 %, légendaire 2 % — à calibrer pour qu'une légendaire reste un événement sans être inatteignable | Phase 4 |

---

## 15. Prochaines étapes

### 15.1 Actions hors développement, sur le chemin critique

1. **Créer l'application Strava et engager la demande de relèvement de quota** (T2).
2. **Faire confirmer par Strava la conformité de l'usage prévu** (T1).
3. **Ouvrir et faire valider le compte Stripe de l'association** (T3).
4. **Réserver le nom de domaine** (A6) — en cours côté PO.
5. **Obtenir un devis ferme de médaille** — conditionne la grille de dons (point P1 du PRD).
6. **Passer Supabase en offre Pro** avant l'ouverture des inscriptions (A2).
7. **Fournir les accès au VPS Hostinger** : adresse, utilisateur de déploiement, clé SSH,
   version du système. Nécessaire pour construire la chaîne de déploiement de l'epic 1.

### 15.1 bis — Précédent à étudier : mycols.app

Le PO signale [mycols.app](https://mycols.app/fr) comme application française récupérant
les activités Strava et proposant des classements entre utilisateurs. Le site n'a pas pu
être consulté depuis l'environnement de développement.

**C'est un précédent encourageant sur le risque T1** — il suggère qu'un usage de ce type
est praticable — mais **ce n'est pas une preuve** : leurs conditions d'accord avec Strava
nous sont inconnues, et une application peut fonctionner un temps sans être conforme.
Cela ne dispense donc pas de la vérification directe auprès de Strava.

En revanche, c'est une **source d'inspiration utile** sur deux points concrets : le
parcours de connexion Strava et la présentation des classements. À regarder au moment de
concevoir ces écrans.

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
