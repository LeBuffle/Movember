# Epic 5 — Cartes et collection

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | fin septembre 2026 |
| **Dépendances** | Epic 4 · visuels fournis par le PO (finition seulement) |
| **Stories** | 8 |

---

## Objectif

Attribuer une carte tirée au sort à chaque défi réussi, et offrir au participant un album
consultable qui donne envie d'être complété.

## Valeur livrée

**C'est ce qui transforme une application de suivi sportif en jeu.** La récompense
immédiate et la collection sont le moteur de rétention sur trente jours.

## Décisions applicables

- **D10 (PRD)** — 1 carte tirée au sort par défi réussi. Quatre raretés : **commune, rare,
  épique, légendaire**. Packs de 5 cartes. Thème moustache.
- **D9 (PRD)** — la difficulté du défi **ne détermine pas** la rareté de la carte.
- **D8 (architecture)** — la colonne `card_grants.source` porte l'intégrité du classement
  collection : seules les valeurs `challenge` et `daily_draw` y sont comptées.
- **D2 (architecture)** — nouvelles cartes ajoutables en cours de mois sans redéploiement.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 5.1 | Schéma des cartes, raretés et attributions | M |
| 5.2 | Moteur de tirage pondéré par rareté | M |
| 5.3 | Attribution transactionnelle d'une carte à la réussite d'un défi | M |
| 5.4 | Album de collection avec les deux compteurs | M |
| 5.5 | Détail d'une carte et animation de révélation | M |
| 5.6 | Création et publication de cartes depuis le back-office | M |
| 5.7 | Attribution automatique des 2 packs bonus du niveau 3 | M |
| 5.8 | Galerie publique de la collection | S |

## Points d'attention

**L'attribution est transactionnelle.** Une erreur en cours ne peut jamais laisser un
participant avec un défi validé sans carte, ni attribuer deux fois la même carte pour le
même défi.

**L'album affiche deux compteurs distincts et explicitement libellés :** « cartes
gagnées » — celle qui compte au classement — et « collection complète », achats inclus.
L'ambiguïté sur ce point ruinerait la lisibilité du classement.

**La légendaire reste accessible gratuitement.** Elle n'est *garantie* que par le bonus du
niveau 3, mais le tirage des défis peut en produire, avec une probabilité faible
(proposition : 2 %). Une rareté strictement payante contredirait la règle « aucun avantage
acheté ».

## Critères de sortie

- [ ] Un défi réussi attribue exactement une carte, tirée selon les poids de rareté.
- [ ] Rattraper trois défis en retard attribue trois cartes.
- [ ] L'album distingue clairement cartes gagnées et collection complète.
- [ ] Une nouvelle carte peut être publiée en cours de mois sans redéploiement.
- [ ] Les participants de niveau 3 reçoivent leurs 2 packs de 5 cartes, dont une
      légendaire garantie.
- [ ] Les probabilités de tirage sont vérifiées par un test statistique.
- [ ] L'album fonctionne avec des visuels de remplacement si les définitifs manquent.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Visuels livrés tardivement | Visuels de remplacement générés en développement ; les images définitives se substituent sans changement de code |
| Probabilités mal calibrées — légendaires trop rares ou trop communes | Poids paramétrables en base, ajustables en cours de mois |
| Double attribution sur incident | Attribution transactionnelle et clé d'unicité sur (défi, participant) |
