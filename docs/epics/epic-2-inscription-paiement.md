# Epic 2 — Inscription payante

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | début septembre 2026 |
| **Dépendances** | Epic 1 · **compte Stripe de l'association validé** (production uniquement) |
| **Stories** | 8 |

---

## Objectif

Permettre à un visiteur de choisir l'un des trois niveaux d'inscription, de payer par
carte via Stripe, et de devenir un participant actif — avec l'enregistrement comptable
immuable qui permettra à l'association de reverser les fonds.

## Valeur livrée

**C'est l'epic qui fait entrer l'argent.** Sans lui, il n'y a pas de collecte, et donc pas
de projet. Il livre aussi la base comptable dont l'association a besoin pour son
reversement.

## Exigences couvertes

FR10 à FR20 · FR13, FR14, FR16 · NFR14, NFR15, NFR16

## Décisions applicables

- **D5 (architecture)** — Stripe Checkout hébergé. La redirection de retour n'est jamais
  une preuve de paiement : **seul le webhook fait foi**.
- **D12 (architecture)** — le montant reversé est calculé et figé à l'encaissement, avec
  les frais réels récupérés auprès de Stripe.
- **D6 (PRD)** — la mention « pas de reçu fiscal » est affichée **avant** le paiement.
- **D1 (PRD)** — les montants et les parts reversées sont lus en base, jamais transmis par
  le navigateur.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 2.1 | Schéma des niveaux d'inscription et données de l'édition | M |
| 2.2 | Page publique de présentation et comparatif des 3 niveaux | M |
| 2.3 | Création d'une session de paiement Stripe Checkout | M |
| 2.4 | Traitement du webhook de paiement et activation du participant | M |
| 2.5 | Page de confirmation et e-mail de bienvenue | M |
| 2.6 | Enregistrement comptable avec frais réels | M |
| 2.7 | Collecte de l'adresse de livraison pour les niveaux 2 et 3 | M |
| 2.8 | Remboursement depuis le back-office | S |

## Critères de sortie

- [ ] Un visiteur peut payer en mode test et devenir participant actif.
- [ ] Un paiement abandonné ne crée pas de participant et peut être repris.
- [ ] Un webhook rejoué ne crée jamais de double inscription ni de double ligne
      comptable.
- [ ] La ligne comptable porte le brut, les frais réels Stripe, le net et la part
      reversée.
- [ ] Les mentions « pas de reçu fiscal » et l'acceptation des CGV sont exigées avant le
      paiement.
- [ ] Les participants de niveau 2 et 3 peuvent renseigner leur adresse de livraison.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Compte Stripe non validé à temps | Tout l'epic se développe et se teste **en mode test**. Seul le basculement en mode réel est bloqué |
| Webhook manqué en production | Réconciliation périodique avec Stripe (story 9.x) et rejeu manuel possible depuis le back-office |
| Grille de dons non figée (devis médaille manquant) | Les montants sont en base : les modifier ne demande aucun développement, et les paiements déjà encaissés ne changent pas (D12) |
