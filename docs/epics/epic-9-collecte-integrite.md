# Epic 9 — Collecte, comptabilité et intégrité du jeu

| | |
| --- | --- |
| **Priorité** | Must |
| **Jalon visé** | fin septembre 2026 |
| **Dépendances** | Epic 2 · Epic 3 |
| **Stories** | 9 |

---

## Objectif

Fournir à l'association le tableau de bord de collecte et les exports dont elle a besoin
pour reverser les fonds et expédier les médailles, et donner à l'organisation les outils
pour arbitrer les activités suspectes.

## Valeur livrée

**Sans cet epic, l'association ne peut pas faire son don.** C'est la finalité même du
projet : la collecte doit être traçable, rapprochable avec Stripe, et exploitable par un
trésorier bénévole.

L'anti-triche protège quant à lui la crédibilité du jeu : une triche visible démobilise
les participants honnêtes bien plus qu'elle n'avantage le tricheur.

## Décisions applicables

- **D12 (architecture)** — les lignes comptables sont immuables et portent les frais
  réels Stripe, pas une estimation.
- **D10 (architecture)** — anti-triche **par signalement, jamais par rejet automatique**.
  Une activité signalée part en file d'arbitrage ; l'administrateur tranche.
- Les activités **saisies manuellement** sur Strava sont écartées de l'évaluation. Les
  activités **importées depuis une montre** sont acceptées — c'est le cas normal d'un
  utilisateur Garmin ou Polar.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 9.1 | Tableau de bord de collecte : encaissements, frais, net reversable | M |
| 9.2 | Ventilation par niveau d'inscription et par type de paiement | M |
| 9.3 | Export comptable tabulaire rapprochable avec Stripe | M |
| 9.4 | Export des adresses de livraison des médailles | M |
| 9.5 | Réconciliation périodique avec Stripe et rejeu des webhooks manqués | M |
| 9.6 | Règles de cohérence et signalement des activités aberrantes | M |
| 9.7 | File d'arbitrage des activités signalées | M |
| 9.8 | Traitement des activités manuelles et importées | M |
| 9.9 | Seuils de détection paramétrables | S |

## Critères de sortie

- [ ] Le tableau de bord affiche en temps réel le montant collecté, les frais, les
      remboursements et le net reversable.
- [ ] L'export comptable se rapproche **ligne à ligne** avec le relevé Stripe.
- [ ] L'export des adresses de livraison est filtrable par niveau.
- [ ] Un webhook Stripe manqué est détecté et rejouable, sans double comptabilisation.
- [ ] Une activité aberrante est signalée mais **jamais rejetée automatiquement**.
- [ ] L'administrateur arbitre un cas signalé en deux clics, avec motif tracé.
- [ ] Une activité saisie manuellement sur Strava n'est pas évaluée ; une activité
      importée d'une montre l'est.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Export inexploitable par le trésorier | Format tabulaire standard, colonnes alignées sur le relevé Stripe, **validé avec le PO avant le gel** |
| Faux positifs anti-triche démobilisants | Signalement et non rejet ; arbitrage humain systématique ; seuils ajustables |
| Adresses de livraison incomplètes en fin de jeu | Relance automatique des participants de niveau 2 et 3 sans adresse renseignée |
