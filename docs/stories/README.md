# Stories — DEFI Movember

| | |
| --- | --- |
| **Version** | v1 — Phase 4 BMAD (Scrum Master) |
| **Date** | 3 août 2026 |
| **Statut** | Epics 1, 2 et 4 détaillés · epics 3 et 5 à 11 à détailler au fil de l'avancement |

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
| 2.3 | [Création de la session de paiement Stripe](2.3.session-paiement-stripe.md) | Draft | 2.2 |
| 2.4 | [Webhook de paiement et activation du participant](2.4.webhook-activation.md) | Draft | 2.3 |
| 2.5 | [Page de confirmation et e-mail de bienvenue](2.5.confirmation-et-bienvenue.md) | Draft | 2.4 |
| 2.6 | [Ligne comptable avec les frais réels](2.6.ligne-comptable-frais-reels.md) | Draft | 2.4 |
| 2.7 | [Adresse de livraison des contreparties](2.7.adresse-de-livraison.md) | Draft | 2.4 |
| 2.8 | [Remboursement depuis le back-office](2.8.remboursement.md) | Draft | 2.6, 1.10 |

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

## Epic 4 : Moteur de défis

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 4.1 | [Schéma du catalogue et validation des configurations](4.1.schema-catalogue-defis.md) | Draft | 1.6 |
| 4.2 | [Création et modification d'un défi depuis le back-office](4.2.back-office-catalogue.md) | Draft | 4.1, 1.10 |
| 4.3 | [**Premier évaluateur de bout en bout : distance**](4.3.premier-evaluateur-distance.md) | Draft | 4.1 |
| 4.4 | [Attribution quotidienne individuelle](4.4.attribution-quotidienne.md) | Draft | 4.1, 1.4 |
| 4.5 | [Défis cumulables](4.5.defis-cumulables.md) | Draft | 4.3, 4.4 |
| 4.6 | [Défis en cours et progression côté participant](4.6.affichage-defis-en-cours.md) | Draft | 4.4 |
| 4.7 | [Les six évaluateurs restants](4.7.evaluateurs-restants.md) | Draft | 4.3 |
| 4.8 | [Défi commun imposé à tous](4.8.defi-commun.md) | Draft | 4.4 |
| 4.9 | [Historique des défis](4.9.historique-defis.md) | Draft | 4.5 |
| 4.10 | [Arbitrage manuel](4.10.arbitrage-manuel.md) | Draft | 4.5, 1.10 |

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

## Stories des epics 2 à 11

Elles seront rédigées **au fil de l'avancement**, epic par epic, plutôt que toutes
d'avance. Deux raisons :

1. Le découpage de l'epic 4 (moteur de défis) bénéficiera de ce qu'on aura appris en
   construisant le socle.
2. Plusieurs points restent à trancher avec le PO (barème de points, prix des packs,
   probabilités de tirage) et figeraient prématurément des critères d'acceptation.

Le contenu de chaque epic, ses stories prévues et ses critères de sortie sont déjà définis
dans [`../epics/`](../epics/).
