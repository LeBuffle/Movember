# Epic 10 — Packs achetables

| | |
| --- | --- |
| **Priorité** | Should — **seul epic pouvant glisser après le 1ᵉʳ novembre** |
| **Jalon visé** | avant le 1ᵉʳ novembre si le calendrier le permet |
| **Dépendances** | Epic 2 · Epic 5 |
| **Stories** | 5 |

---

## Objectif

Permettre au participant d'acheter des packs de 5 cartes en cours de jeu, sans que cet
achat ne procure le moindre avantage au classement.

## Valeur livrée

Revenu supplémentaire **intégralement reversé** à la fondation, et plaisir de collection
pour les joueurs les plus enthousiastes.

## Pourquoi cet epic peut attendre

**Le jeu fonctionne entièrement sans lui.** Les 30 défis du mois sont réalisables avec la
seule inscription de niveau 1, et les 2 packs bonus du niveau 3 sont attribués
automatiquement par l'epic 5 — ils ne dépendent pas de cet epic.

C'est donc la seule variable d'ajustement du calendrier. Si le 1ᵉʳ octobre approche et
qu'un choix doit être fait, **c'est ici qu'on coupe** — et l'achat de packs peut être
ouvert en cours de mois de novembre, ce qui constitue même une animation en soi.

## Décisions applicables

- **D2 (PRD)** — le jeu est intégralement jouable sans acheter le moindre pack.
- **D8 (architecture)** — les cartes issues d'un pack acheté portent `source = 'pack'` et
  sont **exclues du classement collection**.
- **D10 (PRD)** — un pack contient 5 cartes. Les probabilités et garanties sont
  paramétrables.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 10.1 | Schéma des packs et règles de composition | S |
| 10.2 | Boutique de packs dans l'application | S |
| 10.3 | Paiement d'un pack via Stripe Checkout | S |
| 10.4 | Ouverture d'un pack et révélation des cartes | S |
| 10.5 | Comptabilisation du revenu des packs dans la collecte | S |

## Critères de sortie

- [ ] Un participant achète un pack et reçoit 5 cartes.
- [ ] Les garanties annoncées sont respectées à chaque ouverture.
- [ ] **Les cartes achetées n'apparaissent pas dans le classement collection** — vérifié
      par un test automatisé.
- [ ] Le revenu des packs apparaît dans le tableau de bord de collecte, distinct des
      inscriptions.
- [ ] Le montant est intégralement comptabilisé comme reversable.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Perception de « payer pour gagner » | Cartes achetées exclues du classement, et règle affichée explicitement dans la boutique |
| Développé au détriment du chemin critique | Epic explicitement déclassé : **il coupe en premier** si le calendrier se tend |
