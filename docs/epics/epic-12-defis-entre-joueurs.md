# Epic 12 — Défis entre joueurs et portefeuille

| | |
| --- | --- |
| **Priorité** | Should — ajout de périmètre validé par le PO le 11 août |
| **Jalon visé** | **ouvert dès le 1ᵉʳ novembre**, donc fini et testé avant le gel du 1ᵉʳ octobre |
| **Dépendances** | Epic 2 (paiement) · Epic 4 (moteur de défis) · Epic 7 (classements) |
| **Stories** | 8 |
| **Statut** | Périmètre et décisions validés — stories rédigées, développement en attente du feu vert |

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

## Ce que j'ai ajouté aux règles, et pourquoi

Ces points ne figuraient pas dans la demande. Ils sont nécessaires pour que le mécanisme
tienne debout, et le PO les a validés le 11 août.

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
| Crédits achetés et jamais dépensés | Reversés à la fondation (P8). **À écrire dans les CGV avant la première vente** |
| **Périmètre ajouté après la clôture** | L'epic 11 et le contenu de septembre passent avant. Cet epic se coupe en entier sans rien casser |

---

## Décisions prises par le PO — 11 août

### P7 — Un défi relevé ne rapporte **rien au classement**

Le mécanisme est social : fierté, riposte, plaisanterie. Aucun point, aucune carte.

**C'est la décision qui rend toutes les autres protections inutiles.** Deux amis qui se
renverraient des défis toute la journée n'ont rien à gagner : il n'y a donc ni plafond de
points quotidien à écrire, ni détection de paires récurrentes, ni arbitrage à prévoir. Le
classement reste exactement ce qu'il était.

### P8 — Les crédits non dépensés au 30 novembre sont **reversés à la fondation**

L'argent est encaissé et déjà destiné au don. **À écrire dans les CGV avant la première
vente** — un crédit acheté et non utilisé dont le sort n'est pas annoncé est une
réclamation qui arrive en décembre.

### P9 — Un interrupteur « ne pas me défier », en plus du plafond

Un réglage dans « Mon compte », désactivable à tout moment.

### P10 — Prix des lots : **5 crédits pour 10 €**, **10 crédits pour 20 €**

Prix unitaire identique dans les deux lots : la remise n'est pas le sujet, le lot existe
pour amortir les frais Stripe. Les montants vivent en base et se changent en une
instruction SQL.

### Calendrier — ouvert dès le premier jour

Le PO a tranché : le mécanisme est disponible **le 1ᵉʳ novembre au matin**, pas ouvert en
cours de mois. Conséquence directe : cet epic doit être **fini, déployé et testé avant le
gel du 1ᵉʳ octobre**, au même titre que les onze autres.

> Il reste néanmoins **le seul epic qui peut être coupé sans rien casser** : les défis
> quotidiens, les cartes, les classements et les équipes ne dépendent d'aucune de ses
> lignes. Si octobre se tend, c'est ici qu'on coupe — et le drapeau d'ouverture le permet
> jusqu'au dernier moment.
