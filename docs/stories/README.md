# Stories — DEFI Movember

| | |
| --- | --- |
| **Version** | v1 — Phase 4 BMAD (Scrum Master) |
| **Date** | 3 août 2026 |
| **Statut** | Epics 1 à 7 détaillés · epics 8 à 11 à détailler au fil de l’avancement |

---

## Sprint 0 — Epic 1 : Fondations et squelette déployable

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 1.1 | [Initialisation du projet Next.js](1.1.initialisation-projet.md) | **Review** | — |
| 1.2 | [Conteneurisation Docker et reverse proxy](1.2.conteneurisation.md) | **Review** | 1.1 |
| 1.3 | [Déploiement automatisé vers la préproduction](1.3.deploiement-preproduction.md) | **Review** | 1.2 |
| 1.4 | [Déploiement en production et retour arrière](1.4.deploiement-production.md) | **Review** | 1.3 |
| 1.5 | [Charte graphique et composants de base](1.5.charte-graphique.md) | **Review** | 1.1 |
| 1.6 | [Base de données, schéma initial et RLS](1.6.base-de-donnees.md) | **Review** | 1.1 |
| 1.7 | [Authentification des comptes](1.7.authentification.md) | **Review** | 1.6 |
| 1.8 | [PWA installable](1.8.pwa-installable.md) | **Review** | 1.1 |
| 1.9 | [Page d'accueil publique et mentions obligatoires](1.9.page-accueil-publique.md) | **Review** | 1.5 |
| 1.10 | [Coquille du back-office et rôle administrateur](1.10.coquille-back-office.md) | **Review** | 1.7 |
| 1.11 | [Supervision, alertes et procédure d'exploitation](1.11.supervision-runbook.md) | **Review** | 1.4 |
| 1.12 | [Coquille de l'espace participant](1.12.coquille-espace-participant.md) | **Review** | 1.5, 7.x |

### Ordre d'exécution recommandé

```
1.1 ──► 1.2 ──► 1.3 ──► 1.4 ──────────────► 1.11
                 │
                 ├──► 1.5 ──► 1.9
                 ├──► 1.6 ──► 1.7 ──► 1.10
                 └──► 1.8
```

**1.1 → 1.2 → 1.3 sont strictement séquentielles** : elles amènent le site en ligne. Dès la
fin de 1.3, le PO peut valider chaque avancement depuis son téléphone.

Ensuite, les branches 1.5/1.9, 1.6/1.7/1.10 et 1.8 sont indépendantes et se mènent dans
l'ordre qui arrange.

### Ce qui bloque quoi

| Prérequis externe | Bloque | Contournement |
| --- | --- | --- |
| Accès au VPS (adresse, utilisateur, clé SSH) | 1.3, 1.4, 1.11 | 1.1, 1.2, 1.5, 1.6, 1.7, 1.8 se mènent sans |
| Nom de domaine | 1.3 (partiellement) | Déployer sur l'adresse IP, brancher le domaine ensuite |
| Projet Supabase | 1.6 et suivantes | Aucun — à créer en premier, c'est gratuit et immédiat |

---

## Epic 2 : Inscription payante

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 2.1 | [Schéma des inscriptions et des paiements](2.1.schema-inscriptions-paiements.md) | **Review** | 1.6 |
| 2.2 | [Parcours de choix du niveau](2.2.parcours-choix-niveau.md) | **Review** | 2.1, 1.9 |
| 2.3 | [Création de la session de paiement Stripe](2.3.session-paiement-stripe.md) | **Review** | 2.2 |
| 2.4 | [Webhook de paiement et activation du participant](2.4.webhook-activation.md) | **Review** | 2.3 |
| 2.5 | [Page de confirmation et e-mail de bienvenue](2.5.confirmation-et-bienvenue.md) | **Review** | 2.4 |
| 2.6 | [Ligne comptable avec les frais réels](2.6.ligne-comptable-frais-reels.md) | **Review** | 2.4 |
| 2.7 | [Adresse de livraison des contreparties](2.7.adresse-de-livraison.md) | **Review** | 2.4 |
| 2.8 | [Remboursement depuis le back-office](2.8.remboursement.md) | **Review** | 2.6, 1.10 |

### Ordre d'exécution

```
2.1 ──► 2.2 ──► 2.3 ──► 2.4 ──┬──► 2.5
                               ├──► 2.6 ──► 2.8
                               └──► 2.7
```

Strictement séquentielles jusqu'à 2.4 : chacune a besoin de la précédente. À partir de là,
les trois branches sont indépendantes.

### Ce qui bloque quoi

| Prérequis externe | Bloque | Contournement |
| --- | --- | --- |
| **Compte Stripe** *(même non validé)* | 2.3 et suivantes | **2.1 et 2.2 se mènent sans**. Le mode test suffit pour tout l'epic ; seul le basculement en réel demande un compte validé |
| Service d'envoi d'e-mails (Resend) | 2.5 | Le reste de l'epic fonctionne sans |
| Devis de la médaille | aucun | Les montants sont en base : les changer ne demande aucun développement, et les paiements déjà encaissés ne bougent pas |

> **Le compte Stripe est le seul vrai point de passage.** Créer un compte prend quelques
> minutes et donne immédiatement des clés de test ; la validation par Stripe — qui demande
> les pièces de l'association — n'est nécessaire que pour encaisser réellement, donc en
> octobre.

---

## Epic 3 : Connexion Strava et synchronisation

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 3.1 | [Couche « source d'activité » et activités simulées](3.1.source-activite-simulee.md) | **Review** | 1.6 |
| 3.2 | [Consentement au traitement des données d'activité](3.2.consentement-donnees-activite.md) | **Review** | 1.7 |
| 3.3 | [Connexion OAuth du compte Strava](3.3.connexion-oauth-strava.md) | **Review** | 3.1, 3.2 |
| 3.4 | [Normalisation et minimisation des activités](3.4.normalisation-minimisation.md) | **Review** | 3.1 |
| 3.5 | [Réception des activités par webhook](3.5.webhook-strava.md) | **Review** | 3.3, 3.4 |
| 3.6 | [Rattrapage périodique et import initial](3.6.rattrapage-import-initial.md) | **Review** | 3.3, 3.4 |
| 3.7 | [Rafraîchissement des jetons et connexions expirées](3.7.rafraichissement-jetons.md) | **Review** | 3.3 |
| 3.8 | [État de la connexion et resynchronisation](3.8.etat-connexion-resync.md) | **Review** | 3.6, 3.7 |
| 3.9 | [Comportement dégradé si Strava est indisponible](3.9.mode-degrade-strava.md) | **Review** | 3.5, 3.6 |

### Ordre d'exécution

```
3.1 ──┬──► 3.4 ──┬──► 3.5 ──┬──► 3.9
      │          │          │
      └──► 3.2 ──┴► 3.3 ──┬─┴──► 3.6 ──┬──► 3.8
                          └──► 3.7 ─────┘
```

**3.1 en premier, avant même l'authentification Strava, et c'est délibéré.** Elle livre la
couche d'abstraction et un jeu d'activités simulées : c'est la seule réponse possible au
risque externe de l'epic, et c'est ce qui a permis de construire tout l'epic 4 sans Strava.

### Ce qui bloque quoi

| Prérequis externe | Bloque | Contournement |
| --- | --- | --- |
| **Application déclarée chez Strava** (identifiant + secret) | 3.3 et suivantes | **3.1, 3.2 et 3.4 se mènent sans**. La création prend quelques minutes |
| **Quota d'athlètes relevé par Strava** | 3.3 en production | Le quota d'origine suffit pour développer et tester à quelques comptes. ⚠️ **Délai non maîtrisé : à demander le plus tôt possible** |
| **Conformité de l'usage au contrat développeur Strava** | rien techniquement | ⚠️ **Vérification à mener par le PO sans délai.** Si l'usage prévu — classements entre participants à partir de données Strava — n'était pas conforme, c'est le concept du jeu qui serait à revoir, pas le code |
| Un seul abonnement webhook par application Strava | 3.5 | Préproduction ou production, pas les deux. L'environnement non abonné vit sur le rattrapage de la story 3.6 |

> **Epic 3 terminé** — les neuf stories sont en Review. Il reste au PO à créer l'abonnement
> webhook et à installer les deux tâches planifiées (`jetons`, `rattrapage`).

> **C'est l'epic le plus risqué du projet, et le risque n'est pas technique.** Les deux
> points d'interrogation — le quota et la conformité — se règlent auprès de Strava, avec des
> délais que personne ici ne maîtrise. Le découpage les contient ; il ne les supprime pas.

---

## Epic 4 : Moteur de défis

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 4.1 | [Schéma du catalogue et validation des configurations](4.1.schema-catalogue-defis.md) | **Review** | 1.6 |
| 4.2 | [Création et modification d'un défi depuis le back-office](4.2.back-office-catalogue.md) | **Review** | 4.1, 1.10 |
| 4.3 | [**Premier évaluateur de bout en bout : distance**](4.3.premier-evaluateur-distance.md) | **Review** | 4.1 |
| 4.4 | [Attribution quotidienne individuelle](4.4.attribution-quotidienne.md) | **Review** | 4.1, 1.4 |
| 4.5 | [Défis cumulables](4.5.defis-cumulables.md) | **Review** | 4.3, 4.4 |
| 4.6 | [Défis en cours et progression côté participant](4.6.affichage-defis-en-cours.md) | **Review** | 4.4 |
| 4.7 | [Les six évaluateurs restants](4.7.evaluateurs-restants.md) | **Review** | 4.3 |
| 4.8 | [Défi commun imposé à tous](4.8.defi-commun.md) | **Review** | 4.4 |
| 4.9 | [Historique des défis](4.9.historique-defis.md) | **Review** | 4.5 |
| 4.10 | [Arbitrage manuel](4.10.arbitrage-manuel.md) | **Review** | 4.5, 1.10 |

### Ordre d'exécution

```
4.1 ──┬──► 4.3 ──┬──► 4.5 ──┬──► 4.9
      │          │          └──► 4.10
      │          └──► 4.7
      ├──► 4.2
      └──► 4.4 ──┬──► 4.6
                 └──► 4.8
```

**4.3 avant tout le reste des évaluateurs, et c'est délibéré.** Un seul type mené du
catalogue jusqu'au résultat affiché : si le modèle d'évaluateur est mal conçu, on le
découvre sur un type, pas sur sept.

### Ce qui bloque quoi

| Prérequis | Bloque | Contournement |
| --- | --- | --- |
| **Activités sportives** *(epic 3)* | 4.3 et suivantes | **Un jeu d'activités simulées est livré par la story 4.3**, comme le prévoyait la story 3.1. Tout l'epic se développe et se teste sans Strava |
| **Participants actifs** *(epic 2)* | 4.4 en production | Se développe et se teste avec des comptes de préproduction |
| **Catalogue rédigé** | rien techniquement | ⚠️ **Chantier de contenu à mener en septembre** : plusieurs dizaines de défis, avec des variantes de difficulté par sport. C'est le risque principal de l'epic, et il n'est pas technique |

> **Le catalogue est un travail de contenu, pas de développement.** Un catalogue trop
> maigre produit des répétitions sur trente jours, et le code ne peut rien y faire. Compter
> 60 à 80 défis pour tenir un mois sans lasser.

---

## Epic 5 : Cartes et collection

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 5.1 | [Schéma des cartes, raretés et attributions](5.1.schema-cartes-raretes.md) | **Review** | 4.1 |
| 5.2 | [Moteur de tirage pondéré par rareté](5.2.tirage-pondere-rarete.md) | **Review** | 5.1 |
| 5.3 | [Attribution transactionnelle à la réussite d'un défi](5.3.attribution-transactionnelle.md) | **Review** | 5.2, 4.3 |
| 5.4 | [Album de collection avec les deux compteurs](5.4.album-collection.md) | **Review** | 5.3 |
| 5.5 | [Détail d’une carte et révélation](5.5.detail-carte-revelation.md) | **Review** | 5.4 |
| 5.6 | [Création et publication de cartes](5.6.back-office-cartes.md) | **Review** | 5.1, 1.10 |
| 5.7 | [Packs bonus du niveau 3](5.7.packs-bonus-niveau-3.md) | **Review** | 5.2, 2.4 |
| 5.8 | [Galerie publique de la collection](5.8.galerie-publique.md) | **Review** | 5.6 |

### Ordre d'exécution

```
5.1 ──┬──► 5.2 ──┬──► 5.3 ──► 5.4 ──► 5.5
      │          └──► 5.7
      └──► 5.6 ──► 5.8
```

### Ce qui bloque quoi

| Prérequis | Bloque | Contournement |
| --- | --- | --- |
| **Visuels des cartes** *(chantier PO)* | 5.8 réellement | ⚠️ **Une cinquantaine de visuels à produire en septembre.** Des visuels de remplacement sont générés en développement, et les définitifs se substituent sans toucher au code — c'est la story 5.6 qui le permet |
| Stockage Supabase configuré | 5.6 (téléversement) | Le reste de l'epic se mène sans |
| **Probabilités de tirage** *(point A12)* | rien | Point de départ : commune 60 %, rare 28 %, épique 10 %, légendaire 2 %. Réglables **depuis le back-office** (`/admin/cartes/raretes`), à calibrer en novembre |

> **Epic 5 terminé** — les huit stories sont en Review. Il reste au PO à appliquer les
> trois migrations de cartes et à produire les visuels ; la publication d'une carte ne
> demande plus aucun déploiement.

> **Le risque de cet epic n'est pas technique, il est graphique.** Une cinquantaine de cartes
> à dessiner, et un album de silhouettes grises n'a jamais donné envie à personne de
> collectionner quoi que ce soit.

---

## Epic 6 : Notifications et installation PWA

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 6.1 | [Service worker et abonnement push](6.1.abonnement-push.md) | **Review** | 1.8 |
| 6.2 | [Parcours d’installation guidé](6.2.parcours-installation.md) | **Review** | 1.8, 2.4 |
| 6.3 | [Envoi de notifications push par lots](6.3.envoi-push-par-lots.md) | **Review** | 6.1 |
| 6.4 | [Repli e-mail pour les participants sans push](6.4.repli-email.md) | **Review** | 6.1 |
| 6.5 | [Notification du défi du jour](6.5.notification-defi-du-jour.md) | **Review** | 6.3, 6.4, 4.4 |
| 6.6 | [Notification de validation, groupée](6.6.notification-validation-groupee.md) | **Review** | 6.3, 4.3, 5.3 |
| 6.7 | [Préférences de notification par catégorie](6.7.preferences-notification.md) | **Review** | 6.1 |
| 6.8 | [Envoi manuel depuis le back-office](6.8.envoi-manuel-back-office.md) | **Review** | 6.3, 6.7, 1.10 |

### Ordre d'exécution

```
6.1 ──┬──► 6.3 ──┬──► 6.5
      │          ├──► 6.6
      │          └──► 6.8
      ├──► 6.4 ────┘
      └──► 6.7 ────┘

6.2 (indépendante, mais à livrer avant l'ouverture des inscriptions)
```

**6.1 en premier**, puis 6.3, 6.4 et 6.7 en parallèle : ce sont les trois briques que les
notifications réelles (6.5, 6.6, 6.8) traversent toutes. **6.2 est indépendante du reste
et pourtant la plus urgente sur le calendrier** : elle doit être en place avant que le
premier participant ne s'inscrive, sinon il s'inscrit sans installer.

### Ce qui bloque quoi

| Prérequis externe | Bloque | Contournement |
| --- | --- | --- |
| **Clés VAPID** *(à générer, gratuit et immédiat)* | 6.1 et suivantes | Aucun — une commande, aucune inscription à un service |
| **Compte Resend** | 6.4 | Le push fonctionne sans. Bloque aussi la story 2.5 |
| **Domaine d'expédition authentifié SPF/DKIM** | 6.4 en réel | ⚠️ **À préparer en septembre.** Un domaine neuf qui envoie 800 e-mails d'un coup part en indésirable |
| Appareils de test iPhone **et** Android | 6.2 réellement | Le code se mène sans ; la vérification, non |

> **Epic 6 terminé** — les huit stories sont en Review. Il reste au PO à générer les clés
> VAPID (une commande, gratuite, immédiate), à appliquer les trois migrations, et à créer
> le compte Resend avec son domaine authentifié — ce dernier point **en septembre**.

> **Le risque de cet epic est un taux d'installation insuffisant sur iPhone** (risque T5).
> Aucune notification web n'existe sur iPhone hors application installée, et rien dans le
> code ne rattrape quelqu'un qui ne l'a pas installée. D'où l'installation traitée comme
> une étape du parcours d'inscription, et le repli e-mail traité comme un canal de premier
> rang.

---

## Epic 7 : Équipes, classements et fil d'actualité

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 7.1 | [Schéma des équipes et adhésion par code](7.1.schema-equipes.md) | **Review** | 1.6 |
| 7.2 | [Création et gestion d'une équipe](7.2.gestion-equipe.md) | **Review** | 7.1 |
| 7.3 | [Vue matérialisée des classements](7.3.vue-materialisee-classements.md) | **Review** | 4.3, 5.3, 7.1 |
| 7.4 | [Affichage des classements](7.4.affichage-classements.md) | **Review** | 7.3 |
| 7.5 | [Classement par équipe normalisé](7.5.classement-equipe.md) | **Review** | 7.3, 7.1 |
| 7.6 | [Tableau de bord personnel](7.6.tableau-de-bord.md) | **Review** | 7.3 |
| 7.7 | [Compteurs collectifs](7.7.compteurs-collectifs.md) | **Review** | 7.3, 2.6 |
| 7.8 | [Fil d'actualité et publication](7.8.fil-actualite.md) | **Review** | 1.10, 5.6 |
| 7.9 | [Page dédiée d'équipe](7.9.page-equipe.md) | **Review** | 7.5 |

### Ordre d'exécution

```
7.1 ──┬──► 7.2
      └──► 7.3 ──┬──► 7.4
                 ├──► 7.5 ──► 7.9
                 ├──► 7.6
                 └──► 7.7

7.8 (indépendante)
```

**7.3 est la clé de voûte de l'epic.** Les huit classements, le tableau de bord et les
compteurs collectifs sortent tous de la même vue matérialisée : une fois qu'elle existe,
les quatre stories qui la lisent sont des écrans.

### Ce qui bloque quoi

| Prérequis | Bloque | Contournement |
| --- | --- | --- |
| Des données de jeu réelles | La vérification de 7.3 à 7.7 | Le code se mène sur des activités simulées ; les chiffres justes demandent un mois de jeu |
| Formule de normalisation validée par le PO | rien techniquement | Point de départ posé en base, ajustable sans redéploiement (7.5) |

> **Epic 7 terminé** — les neuf stories sont en Review. Il reste au PO à appliquer les
> trois migrations (`teams`, `leaderboards`, `news_posts`), à **lancer un premier
> `select public.refresh_leaderboards();`** sans lequel tous les classements resteront
> vides, à installer la tâche planifiée de rafraîchissement, et à trancher l'exposant de
> normalisation d'équipe — une commande SQL, sans redéploiement.

> **Deux règles portent l'intégrité du jeu, et sont vérifiées automatiquement** : le
> classement général ne lit jamais les cartes, et le classement collection ne compte que
> les cartes gagnées en jouant. Un pack acheté ne doit déplacer personne — c'est le seul
> endroit du projet où l'argent pourrait toucher au jeu.

---

## Epic 8 : Back-office d'animation

**Epic transversal.** Quatre de ses tranches ont déjà été livrées avec les epics qui les
utilisent : la coquille et le rôle administrateur (1.10), le catalogue de défis (4.2), les
cartes (5.6), le fil d'actualité (7.8) et les notifications (6.8). Les stories ci-dessous
sont celles qui n'appartiennent à aucun autre epic.

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 8.1 | [Tableau de bord d'accueil de l'administrateur](8.1.tableau-de-bord-admin.md) | **Review** | 1.10, 4.4 |
| 8.2 | [Liste et recherche des participants](8.2.liste-participants.md) | **Review** | 1.10, 2.4 |
| 8.3 | [Fiche détaillée d'un participant](8.3.fiche-participant.md) | **Review** | 8.2 |
| 8.4 | [État du catalogue de défis et alertes](8.4.etat-catalogue-defis.md) | **Review** | 4.1, 4.4 |
| 8.5 | [Prévisualisation avant publication](8.5.previsualisation.md) | Draft | 4.2, 5.6 |
| 8.6 | [Gestion des équipes par l'administrateur](8.6.gestion-equipes-admin.md) | Draft | 7.2 |
| 8.7 | [Suspension ou exclusion d'un participant](8.7.suspension-participant.md) | **Review** | 8.3 |
| 8.8 | [Journal des actions administratives](8.8.journal-actions-admin.md) | **Review** | 1.10 |

### Ordre d'exécution

```
8.2 ──► 8.3 ──► 8.7

8.1 (indépendante)
8.4 (indépendante)
8.8 (indépendante)

8.5, 8.6 : déjà livrées, à vérifier
```

### Ce qui bloque quoi

| Prérequis | Bloque | Contournement |
| --- | --- | --- |
| Des participants réels | La vérification de 8.1 à 8.4 | Les écrans se mènent sur des comptes de test |
| Un catalogue rempli | La projection de rupture (8.4) | La projection se vérifie sur trois défis |

> **Le critère de sortie de cet epic n'est pas technique** : un bénévole non technique doit
> pouvoir créer un défi, publier une carte et envoyer une notification depuis son
> téléphone, sans aide et sans documentation. Il se vérifie avec le PO, sur son téléphone,
> avant le gel des fonctionnalités.


---

## Epic 9 : Collecte, comptabilité et intégrité du jeu

**Deux moitiés sans rapport l'une avec l'autre.** La comptabilité est largement livrée avec
l'epic 2 ; l'anti-triche est entièrement à faire, et c'est le vrai contenu de cet epic.

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 9.1 | [Tableau de bord de collecte](9.1.tableau-collecte.md) | Draft | 2.6 |
| 9.2 | [Ventilation par niveau](9.2.ventilation-collecte.md) | **Review** | 9.1 |
| 9.3 | [Export comptable](9.3.export-comptable.md) | **Review** | 2.6 |
| 9.4 | [Export des adresses de livraison](9.4.export-livraisons.md) | Draft | 2.7 |
| 9.5 | [Réconciliation Stripe et rejeu](9.5.reconciliation-stripe.md) | **Review** | 2.4, 2.6 |
| 9.6 | [Signalement des activités aberrantes](9.6.signalement-activites.md) | **Review** | 3.4 |
| 9.7 | [File d'arbitrage](9.7.file-arbitrage.md) | **Review** | 9.6 |
| 9.8 | [Activités manuelles et importées](9.8.activites-manuelles.md) | **Review** | 3.4 |
| 9.9 | [Seuils paramétrables](9.9.seuils-parametrables.md) | **Review** | 9.6 |

### Ordre d'exécution

```
9.8 (indépendante, et la plus urgente : le drapeau existe mais rien ne l'utilise)

9.6 ──┬──► 9.7
      └──► 9.9

9.2 ──► 9.3

9.5 (indépendante)

9.1, 9.4 : déjà livrées, à vérifier
```

### Ce qui bloque quoi

| Prérequis | Bloque | Contournement |
| --- | --- | --- |
| Des paiements réels chez Stripe | Le rapprochement de 9.3 | Le format se vérifie sur des paiements de test |
| Des activités réelles | Le réglage des seuils de 9.6 | Les règles se mènent sur des activités simulées ; les seuils justes demandent un mois de jeu |

> **Signaler, jamais rejeter** (architecture D10). Un faux positif qui invalide le défi d'un
> participant honnête fait plus de dégâts qu'un tricheur qui passe : le premier arrête de
> jouer et le raconte, le second gagne un classement auquel personne ne tient vraiment.


---

## Epic 10 : Packs achetables

**Le seul epic qui peut glisser après le 1ᵉʳ novembre.** Le jeu est intégralement jouable
sans lui : les trente défis du mois se relèvent avec la seule inscription de niveau 1, et
les deux packs bonus du niveau 3 sont attribués par l'epic 5.

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 10.1 | [Schéma des packs et règles de composition](10.1.schema-packs.md) | **Review** | 5.1 |
| 10.2 | [Boutique de packs](10.2.boutique-packs.md) | **Review** | 10.1 |
| 10.3 | [Paiement d'un pack via Stripe](10.3.paiement-pack.md) | **Review** | 10.1, 2.4 |
| 10.4 | [Ouverture d'un pack et révélation](10.4.ouverture-pack.md) | **Review** | 10.3, 5.5 |
| 10.5 | [Comptabilisation du revenu des packs](10.5.comptabilisation-packs.md) | **Review** | 10.3, 9.2 |

### Ordre d'exécution

```
10.1 ──┬──► 10.2
       └──► 10.3 ──┬──► 10.4
                   └──► 10.5
```

> **Rien de ce qui s'achète ici ne fait gagner une place** (PRD D2, FR72). Les cartes
> issues d'un achat portent `source = 'purchase'` et le classement collection ne compte
> que `challenge` et `daily_draw` — vérifié au niveau de la vue matérialisée, pas de
> l'application. C'est la seule raison pour laquelle une boutique peut exister dans ce jeu.


---

## Statuts BMAD

`Draft` → `Approved` → `InProgress` → `Review` → `Done`

Une story passe en `Approved` après validation du PO, et n'est développée qu'à partir de
là.

---

## Convention de branches

Une branche par story, conformément à `CLAUDE.md` §8 :

```
feat/1.1-initialisation-projet
chore/1.2-conteneurisation
chore/1.3-deploiement-preproduction
feat/1.5-charte-graphique
...
```

Une pull request par branche, squash merge dans `main` après validation du PO.

---

## Epic 11 : Conformité, durcissement et lancement

**L'epic qui fait la différence entre « ça marche sur mon écran » et « on peut ouvrir les
inscriptions ».** C'est aussi celui qu'on sacrifie par manque de temps sur les projets qui
échouent le jour du lancement — d'où son jalon **avant** le gel du 1ᵉʳ octobre, pas après.

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 11.1 | [Export des données personnelles](11.1.export-donnees.md) | **Review** | 1.7 |
| 11.2 | [Suppression de compte et révocation](11.2.suppression-compte.md) | **Review** | 3.8 |
| 11.3 | [Déconnexion de Strava](11.3.deconnexion-strava.md) | **Review** | 3.2, 3.8 |
| 11.4 | [Conservation et purge automatique](11.4.conservation-purge.md) | **Review** | 2.7 |
| 11.5 | [Sauvegardes et restauration testée](11.5.sauvegardes-restauration.md) | **Review** | 1.3 |
| 11.6 | [Pages légales](11.6.pages-legales.md) | **Review** | 11.4 |
| 11.7 | [Revue d'accessibilité](11.7.revue-accessibilite.md) | **Review** | 1.5 |
| 11.8 | [Durcissement du serveur](11.8.durcissement-serveur.md) | **Review** | 1.3 |
| 11.9 | [Répétition générale](11.9.repetition-generale.md) | Draft — **action PO** | tous |
| 11.10 | [Procédure d'exploitation](11.10.runbook.md) | **Review** | 11.5 |

### Ordre d'exécution

```
11.1, 11.3, 11.7, 11.8  (indépendantes)

11.2  (lève deux obstacles de schéma)

11.4 ──► 11.6   (la politique de confidentialité lit la politique de purge)

11.5 ──► 11.10  (le runbook documente le script)

11.9  ◄── tout le reste, une semaine avant l'ouverture
```

### Ce qui reste au PO, et ne peut pas être fait autrement

| Point | Pourquoi c'est lui |
| --- | --- |
| **Restaurer une sauvegarde** | Critère de sortie de l'epic. Demande un accès à la base et une décision. |
| **Lancer le durcissement** | Les commandes peuvent couper l'accès SSH ; personne ne doit les lancer à sa place. |
| **Remplir les mentions légales** | Des faits sur l'association qu'aucun agent ne peut deviner sans les inventer. |
| **Trancher la politique de remboursement** | Point P6, engagement de l'association. |
| **La répétition générale** | Elle cherche ce qu'aucun test ne voit : un enchaînement qui n'a de sens que pour celui qui l'a écrit. |
| **Un parcours au lecteur d'écran** | Une demi-heure sur un vrai téléphone vaut tous les tests structurels. |

> **Une procédure écrite mais jamais exécutée est une procédure fausse.** C'est vrai du
> runbook, du durcissement et de la restauration. Les trois sont outillés ; aucun n'est
> vérifié tant qu'il n'a pas été passé une fois, calmement, avant le 1ᵉʳ novembre.


---

## Stories des epics 6 à 11

Elles seront rédigées **au fil de l'avancement**, epic par epic, plutôt que toutes
d'avance. Deux raisons :

1. Le découpage d'un epic bénéficie de ce qu'on a appris en construisant les précédents —
   l'epic 4 en a été la démonstration.
2. Plusieurs points restent à trancher avec le PO (barème de points, prix des packs,
   probabilités de tirage) et figeraient prématurément des critères d'acceptation.

Le contenu de chaque epic, ses stories prévues et ses critères de sortie sont déjà définis
dans [`../epics/`](../epics/).
