# Epics — DEFI Movember

| | |
| --- | --- |
| **Version** | v1 — Phase 4 BMAD (PO + Scrum Master) |
| **Date** | 3 août 2026 |
| **Documents amont** | [`../brief.md`](../brief.md) v1.1 · [`../prd.md`](../prd.md) v1.1 · [`../architecture.md`](../architecture.md) v1.1 |
| **Statut** | En attente de validation PO |

---

## Ordre de livraison

Les epics sont ordonnés selon le **chemin critique vers le 1ᵉʳ novembre 2026**. Chacun
livre un incrément déployable et vérifiable sur la préproduction.

| # | Epic | Objectif en une phrase | Prio | Jalon visé |
| --- | --- | --- | --- | --- |
| [1](epic-1-fondations.md) | **Fondations et squelette déployable** | Un site en ligne, installable, avec comptes et déploiement automatisé | M | fin août |
| [2](epic-2-inscription-paiement.md) | **Inscription payante** | Un visiteur peut choisir un niveau, payer, et devenir participant | M | début septembre |
| [3](epic-3-strava.md) | **Connexion Strava et synchronisation** | Les activités remontent automatiquement et durablement | M | mi-septembre |
| [4](epic-4-moteur-defis.md) | **Moteur de défis** | Chaque participant reçoit et réussit des défis, évalués automatiquement | M | fin septembre |
| [5](epic-5-cartes-collection.md) | **Cartes et collection** | Un défi réussi donne une carte ; l'album se remplit | M | fin septembre |
| [6](epic-6-notifications-pwa.md) | **Notifications et installation PWA** | Chaque participant est prévenu chaque jour, push ou e-mail | M | fin septembre |
| [7](epic-7-equipes-classements.md) | **Équipes, classements et fil d'actualité** | La dimension collective et compétitive du jeu | M | mi-septembre → fin sept. |
| [8](epic-8-back-office.md) | **Back-office d'animation** | L'organisation est autonome sur les défis, cartes et notifications | M | livré par tranches |
| [9](epic-9-collecte-integrite.md) | **Collecte, comptabilité et intégrité du jeu** | Export comptable exploitable et arbitrage anti-triche | M | fin septembre |
| [10](epic-10-packs.md) | **Packs achetables** | Achat de packs en cours de jeu, sans impact sur le classement | S | après le 1ᵉʳ nov. si besoin |
| [11](epic-11-conformite-lancement.md) | **Conformité, durcissement et lancement** | RGPD, CGV, accessibilité, répétition générale | M | **avant le 1ᵉʳ octobre** |

### Ajouts de périmètre — après la clôture du développement

Demandés par le PO le 11 août, une fois les onze epics livrés. **Les deux sont en
brouillon et attendent une validation avant toute ligne de code** (`CLAUDE.md` §2).

| # | Epic | Objectif en une phrase | Prio | Jalon visé |
| --- | --- | --- | --- | --- |
| [12](epic-12-defis-entre-joueurs.md) | **Défis entre joueurs et portefeuille** | Un participant défie un autre participant, contre des crédits achetés à l'avance | S | **avant le 1ᵉʳ octobre** |
| [13](epic-13-classements-vivants.md) | **Classements vivants** | Cartes, médailles, podium, progression et recherche | S | **avant le 1ᵉʳ octobre** |

> **Ces deux epics ne sont pas sur le chemin critique**, et c'est ce qui les rend sûrs :
> sans eux il y a un jeu complet. Le PO a choisi de les ouvrir dès le 1ᵉʳ novembre, ce qui
> les place avant le gel du 1ᵉʳ octobre — mais ils restent les deux seuls qu'on puisse
> couper en entier si octobre se tend, sans toucher aux défis, aux cartes ni aux équipes.
>
> **L'epic 11 et le travail de contenu de septembre passent devant.** Sans eux il n'y a pas
> de lancement du tout.

---

## Chemin critique

```
Epic 1 ──► Epic 2 ──► Epic 3 ──┬──► Epic 4 ──► Epic 5 ──► Epic 6
 socle      paiement    Strava  │    défis      cartes     notifs
                                │
                                └──► Epic 7 (équipes, classements)

Epic 8 (back-office) ── transversal, livré par tranches dès l'epic 4
Epic 9 (collecte, anti-triche) ── dépend des epics 2 et 3
Epic 10 (packs) ── dépend des epics 2 et 5 · SEUL epic pouvant glisser après le 1ᵉʳ nov.
Epic 11 (conformité, lancement) ── clôt le développement, avant le gel du 1ᵉʳ octobre
```

**Les epics 1 à 6 sont le chemin critique absolu.** Sans eux, il n'y a pas de jeu le
1ᵉʳ novembre.

---

## Trois principes de découpage appliqués

**1. L'epic 1 livre un site réellement en ligne, pas une configuration.** Dès la
story 1.3, une page est visible sur la préproduction depuis un téléphone. Tout le reste
s'y ajoute par incréments visibles.

**2. L'epic 3 porte un risque externe que le découpage neutralise.** Le quota Strava
dépend de Strava. La story 3.1 livre donc un **jeu d'activités simulées** permettant de
développer et tester intégralement les epics 4, 5, 7 et 9 **sans dépendre du déblocage**.
C'est la seule protection possible contre ce risque.

**3. Les préoccupations transversales sont intégrées, jamais reportées.** La sécurité au
niveau des lignes s'écrit avec chaque table. La couche d'abstraction « source d'activité »
existe dès la première story Strava. Le back-office est livré par tranches au fil des
fonctionnalités, pas à la fin.

---

## Travaux hors développement à mener en parallèle

Ces chantiers ne sont pas des stories mais conditionnent le lancement. Ils sont portés
par le PO.

| Chantier | Échéance | Bloque |
| --- | --- | --- |
| Application Strava + demande de relèvement de quota | **immédiat** | Epic 3 en production |
| Confirmation de conformité de l'usage auprès de Strava | **immédiat** | Le concept lui-même |
| Ouverture et validation du compte Stripe de l'association | **immédiat** | Epic 2 en production |
| Devis ferme de médaille | avant l'ouverture | Grille de dons (point P1) |
| Nom de domaine | août | Epic 1 (story 1.3) |
| Accès au VPS (adresse, utilisateur, clé SSH) | **août** | Epic 1 (story 1.3) |
| Passage de Supabase en offre Pro | avant octobre | Sauvegardes (story 11.5) |
| **Visuels des ~50 cartes** | septembre | Epic 5 (finition) |
| **Rédaction du catalogue de 60 à 80 défis** | septembre | Epic 4 (contenu) |
| CGV, politique de confidentialité, mentions légales | septembre | Epic 11 |

> Les deux derniers sont des **travaux de contenu volumineux** souvent sous-estimés. Ils
> ne bloquent pas le développement mais bloquent le lancement.
