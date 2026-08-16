# Epic 4 — Moteur de défis

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | fin septembre 2026 |
| **Dépendances** | Epic 3 (story 3.1 suffit pour développer) |
| **Stories** | 10 |

---

## Objectif

Constituer un catalogue de défis alimentable depuis le back-office, attribuer chaque jour
un défi individuel à chaque participant, et évaluer automatiquement les défis à partir des
activités synchronisées — sans qu'aucun défi n'en bloque un autre.

## Valeur livrée

**C'est le cœur du jeu.** C'est aussi l'epic qui porte la promesse centrale de la
refonte : l'organisation constitue le catalogue en amont, et le mois de novembre se
déroule ensuite sans intervention quotidienne.

## Décisions applicables

- **D2 (architecture)** — le contenu du jeu est piloté par les données. Un défi est une
  ligne en base, jamais du code. Le code fournit un catalogue d'**évaluateurs**, un par
  type.
- **D13 (architecture) / D8 (PRD)** — chaque participant reçoit son propre défi, tiré du
  catalogue. Aucun participant ne reçoit deux fois le même défi.
- **D14 (architecture) / D8 (PRD)** — chaque défi porte une valeur en **points** selon sa
  difficulté ; le classement général cumule les points, pas le nombre de défis.
- **D3 (PRD)** — les défis ne se bloquent pas, restent ouverts, et **une même activité peut
  en valider plusieurs à la fois**.

## Stratégie de découpage

**Un seul type d'évaluateur est livré de bout en bout avant d'ajouter les six autres.** La
story 4.3 livre le type `distance` complet — de la création dans le back-office à
l'attribution du résultat. Ce n'est qu'une fois cette chaîne vérifiée que les autres types
s'ajoutent (story 4.7), chacun étant alors une simple addition au registre.

C'est le découpage qui réduit le plus le risque : si le modèle d'évaluateur est mal conçu,
on le découvre sur un type, pas sur sept.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 4.1 | Schéma du catalogue de défis et validation des configurations | M |
| 4.2 | Création et modification d'un défi depuis le back-office | M |
| 4.3 | **Premier évaluateur de bout en bout : défi de distance** | M |
| 4.4 | Attribution quotidienne individuelle des défis | M |
| 4.5 | Défis cumulables : évaluation de tous les défis ouverts à chaque activité | M |
| 4.6 | Affichage des défis en cours et de leur progression côté participant | M |
| 4.7 | Évaluateurs restants : durée, dénivelé, régularité, multi-sports, collectif, surprise | M |
| 4.8 | Défi commun imposé à tous pour une journée | M |
| 4.9 | Historique des défis du participant | M |
| 4.10 | Arbitrage manuel : validation ou invalidation par l'administrateur | M |

## Critères de sortie

- [ ] L'administrateur crée un défi depuis le back-office **sans redéploiement**.
- [ ] Chaque participant reçoit un défi différent chaque matin.
- [ ] Un participant ne reçoit jamais deux fois le même défi.
- [ ] Une activité valide **tous** les défis ouverts qu'elle satisfait, pas seulement
      celui du jour.
- [ ] Un défi manqué reste ouvert et ne bloque pas le suivant.
- [ ] Les sept types d'évaluateurs fonctionnent et sont couverts par des tests unitaires,
      cas limites compris.
- [ ] Un catalogue épuisé ou sous seuil déclenche une alerte aux administrateurs.
- [ ] L'administrateur peut valider ou invalider un défi manuellement, avec motif tracé.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Catalogue trop maigre — répétitions ou rupture | Alerte automatique sous seuil, défi générique de rattrapage, et **rédaction du catalogue traitée comme un chantier de contenu en septembre** |
| Points mal calibrés — classement perçu comme injuste | Points modifiables en base sans redéploiement ; recalcul complet possible à tout moment |
| Évaluateur erroné publié en cours de mois | Prévisualisation avant publication, validation stricte des configurations, arbitrage manuel possible |
