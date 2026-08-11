# Epic 12 — Défis entre joueurs et portefeuille

| | |
| --- | --- |
| **Priorité** | Could — ajout de périmètre demandé après la clôture du développement |
| **Jalon visé** | à trancher : livré fermé, ouvert en cours de novembre (recommandé) |
| **Dépendances** | Epic 2 (paiement) · Epic 4 (moteur de défis) · Epic 7 (classements) |
| **Stories** | 8 |
| **Statut** | **Brouillon — en attente de validation PO** |

---

## Objectif

Permettre à un participant d'envoyer un défi sportif à un autre participant, contre des
crédits achetés à l'avance, et de recevoir une réponse — relevée ou non — dans les 24 h.

## Valeur livrée

**C'est le premier mécanisme du jeu où deux participants interagissent directement.**
Jusqu'ici chacun joue à côté des autres : mêmes classements, mêmes équipes, mais aucun
geste d'un joueur vers un autre. Un défi lancé nommément crée une raison de revenir dans
la journée, et une histoire à raconter.

Revenu supplémentaire au passage, mais ce n'est pas le sujet : à 2 € l'unité, ce mécanisme
rapporte peu. **Sa valeur est l'engagement.**

---

## Les règles, telles que le PO les a énoncées

| Règle | Détail |
| --- | --- |
| Prix | 2 € le défi, réglé en crédits achetés à l'avance |
| Catalogue | **Fixe, trois défis** : courir 2 km · rouler 10 km · faire une activité dans la journée |
| Délai | 24 h pour relever |
| Protection | **5 défis reçus maximum par tranche de 24 h**, puis un refus poli |
| Pénalité | **Aucune** si le défi n'est pas relevé |
| Riposte | Le défi relevé se **renvoie gratuitement** à son expéditeur |
| Échec | L'expéditeur reçoit un message avec humour, jamais moqueur |

---

## Pourquoi un portefeuille, et pas un paiement par défi

**Ce n'est pas un confort d'interface, c'est de l'argent.** Stripe prélève environ
**1,4 % + 0,25 €** par transaction. Sur un paiement de 2 € :

| Formule | Encaissé | Frais Stripe | **Perte** |
| --- | --- | --- | --- |
| 1 défi à 2 € | 2,00 € | ~0,28 € | **14 %** |
| Pack de 5 à 10 € | 10,00 € | ~0,39 € | **3,9 %** |
| Pack de 10 à 20 € | 20,00 € | ~0,53 € | **2,7 %** |

Payer défi par défi, c'est laisser **un septième de la collecte chez Stripe**. Le critère
d'arbitrage du projet (`CLAUDE.md` §10) tranche seul : chaque euro de frais technique est
un euro en moins pour la collecte.

Le portefeuille n'est donc pas une facilité offerte au joueur, c'est la seule forme
défendable de ce mécanisme.

---

## Décisions applicables

- **D2 (PRD)** — le jeu reste intégralement jouable sans dépenser un centime de plus. Un
  participant qui n'achète aucun crédit peut recevoir des défis, les relever, et riposter
  gratuitement.
- **D8 (architecture)** — rien de ce qui s'achète ne doit améliorer un classement.
- **D5 (architecture)** — seul le webhook Stripe crédite un portefeuille. Le retour depuis
  Stripe ne prouve rien.
- **`CLAUDE.md` §6** — les crédits sont un **achat avec contrepartie**, pas un don. La
  mention fiscale s'applique telle quelle.

---

## Ce que j'ajoute aux règles, et pourquoi

Ces points ne figuraient pas dans la demande. Ils me paraissent nécessaires pour que le
mécanisme tienne debout ; ils sont à valider ou à écarter.

### 1. Une activité ne vaut que si elle est postérieure au défi

**C'est le point qui décide si le mécanisme a un sens.** Sans cette règle, un participant
qui reçoit « courir 2 km » à 18 h le valide avec sa sortie de 7 h du matin, sans bouger de
sa chaise. Le défi ne serait plus un défi.

L'activité doit donc **démarrer après l'heure d'envoi** du défi, et se terminer dans les
24 h. Le moteur d'évaluation de l'epic 4 sait déjà lire une fenêtre temporelle ; c'est le
même mécanisme, avec des bornes plus étroites.

### 2. La riposte gratuite ne compte pas dans le plafond de 5

Sinon, une personne très sollicitée ne pourrait plus riposter — alors que la riposte est
précisément la récompense du défi relevé. Elle est naturellement bornée : une riposte par
défi reçu et relevé, vers l'expéditeur d'origine et personne d'autre.

### 3. On ne défie que des participants actifs, et jamais soi-même

Un défi envoyé à quelqu'un dont l'inscription n'est pas finalisée, ou qui a été suspendu,
est un crédit dépensé pour rien.

### 4. Le crédit est rendu si le défi ne part pas

Plafond atteint, destinataire protégé, joueur suspendu entre-temps : le crédit revient au
portefeuille. Un crédit perdu sur un refus est une réclamation garantie.

### 5. Un interrupteur « ne pas me défier »

La limite de 5 par jour protège d'un déluge, pas d'un acharnement. Sur trente jours, une
personne peut recevoir 150 défis sans jamais avoir demandé à jouer à ça. Un réglage dans
« Mon compte », désactivable à tout moment, coûte une colonne et une case à cocher.

> **Ce n'est pas une précaution théorique.** Le jeu s'adresse à des collègues et à des amis
> qui se connaissent, et le mécanisme consiste à désigner quelqu'un nommément. C'est
> exactement le terrain où une plaisanterie devient du harcèlement sans que personne l'ait
> voulu.

---

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 12.1 | Schéma du portefeuille, des crédits et des défis entre joueurs | M |
| 12.2 | Achat de crédits par lots via Stripe | M |
| 12.3 | Envoi d'un défi depuis le classement ou la page d'un joueur | M |
| 12.4 | Protection du destinataire : plafond, interrupteur, refus poli | M |
| 12.5 | Validation d'un défi reçu dans les 24 h, activité postérieure exigée | M |
| 12.6 | Riposte gratuite et message d'échec humoristique | M |
| 12.7 | Notifications : défi reçu, défi relevé, défi échoué, expiration proche | S |
| 12.8 | Comptabilisation des crédits dans la collecte | M |

---

## Ordre d'exécution

```
12.1 ──┬──► 12.2 ──► 12.8
       │
       └──► 12.3 ──► 12.4 ──► 12.5 ──► 12.6
                                       └──► 12.7
```

---

## Critères de sortie

- [ ] Un participant achète 5 crédits, en dépense un, et le solde est exact.
- [ ] Le défi arrive chez le destinataire et **pas ailleurs**.
- [ ] Une activité **antérieure** à l'envoi ne valide pas le défi — vérifié par un test.
- [ ] Le sixième défi de la journée est refusé poliment, et **le crédit est rendu**.
- [ ] Un participant qui a coupé les défis n'en reçoit aucun.
- [ ] Un défi non relevé n'a **aucune** conséquence sur le classement.
- [ ] La riposte est gratuite et ne part qu'à l'expéditeur d'origine.
- [ ] Le revenu des crédits apparaît dans la collecte, distinct des inscriptions et des packs.

---

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| **Harcèlement d'un participant** | Plafond de 5 par 24 h, interrupteur individuel, et journal des envois consultable par l'organisation |
| **Deux amis se renvoient des défis en boucle** | Sans points au classement, il n'y a rien à gagner à le faire — c'est l'argument principal pour ne rien faire gagner |
| Validation avec une activité du matin | Fenêtre temporelle stricte : l'activité démarre après l'envoi |
| Crédits achetés et jamais dépensés | À trancher (voir ci-dessous) et à écrire dans les CGV **avant** la première vente |
| **Périmètre ajouté après la clôture** | L'epic 11 et le contenu de septembre passent avant. Cet epic se coupe en entier sans rien casser |

---

## Ce qui reste à trancher — décisions PO

Ces quatre points changent le code. Je ne les invente pas.

### P7 — Un défi relevé rapporte-t-il quelque chose ?

| Option | Conséquence |
| --- | --- |
| **Rien au classement** *(recommandé)* | Le mécanisme est social : fierté, riposte, plaisanterie. Impossible à truquer, aucun garde-fou supplémentaire à écrire, et le classement reste ce qu'il a toujours été |
| Une carte, hors classement | Comme un pack acheté : elle enrichit l'album sans compter au classement collection |
| Des points au classement | ⚠️ Deux amis peuvent se renvoyer des défis toute la journée et monter ensemble. Demande un plafond de points quotidien et une détection des paires récurrentes |

### P8 — Que deviennent les crédits non dépensés au 30 novembre ?

| Option | Conséquence |
| --- | --- |
| **Reversés à la fondation** *(recommandé)* | L'argent est encaissé et déjà destiné au don. Simple, cohérent, **à écrire dans les CGV avant l'ouverture** |
| Remboursés sur demande | Chaque remboursement coûte des frais Stripe et du travail, pour 2 à 10 € |
| Remboursés automatiquement | ⚠️ Frais parfois supérieurs au montant remboursé |

### P9 — Quelle protection au-delà du plafond de 5 par jour ?

| Option | Conséquence |
| --- | --- |
| **Interrupteur « ne pas me défier »** *(recommandé)* | Une colonne, une case à cocher, et une réponse à donner à la personne qui n'aime pas être sollicitée |
| Blocage individuel | Plus fin, mais demande un écran de gestion et désigne quelqu'un nommément |
| Rien de plus | ⚠️ Aucun recours pour qui reçoit 5 défis par jour pendant un mois |

### P10 — Prix des lots de crédits

Proposition, à confirmer : **5 crédits pour 10 €**, **10 crédits pour 20 €**. Prix unitaire
identique, la remise n'étant pas le sujet — le lot existe pour amortir les frais Stripe.
Comme le reste, ces montants vivront en base et se changeront en une instruction SQL.
