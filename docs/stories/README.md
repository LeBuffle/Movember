# Stories — DEFI Movember

| | |
| --- | --- |
| **Version** | v1 — Phase 4 BMAD (Scrum Master) |
| **Date** | 3 août 2026 |
| **Statut** | Epic 1 détaillé · epics 2 à 11 à détailler au fil de l'avancement |

---

## Sprint 0 — Epic 1 : Fondations et squelette déployable

| # | Story | Statut | Dépend de |
| --- | --- | --- | --- |
| 1.1 | [Initialisation du projet Next.js](1.1.initialisation-projet.md) | **Review** | — |
| 1.2 | [Conteneurisation Docker et reverse proxy](1.2.conteneurisation.md) | **Review** | 1.1 |
| 1.3 | [Déploiement automatisé vers la préproduction](1.3.deploiement-preproduction.md) | Draft | 1.2 · **accès VPS** |
| 1.4 | [Déploiement en production et retour arrière](1.4.deploiement-production.md) | Draft | 1.3 |
| 1.5 | [Charte graphique et composants de base](1.5.charte-graphique.md) | **Review** | 1.1 |
| 1.6 | [Base de données, schéma initial et RLS](1.6.base-de-donnees.md) | Draft | 1.1 · **projet Supabase** |
| 1.7 | [Authentification des comptes](1.7.authentification.md) | Draft | 1.6 |
| 1.8 | [PWA installable](1.8.pwa-installable.md) | Draft | 1.1 |
| 1.9 | [Page d'accueil publique et mentions obligatoires](1.9.page-accueil-publique.md) | Draft | 1.5 |
| 1.10 | [Coquille du back-office et rôle administrateur](1.10.coquille-back-office.md) | Draft | 1.7 |
| 1.11 | [Supervision, alertes et procédure d'exploitation](1.11.supervision-runbook.md) | Draft | 1.4 |

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
