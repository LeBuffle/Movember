# Epic 14 — Super-équipes et logos

| | |
| --- | --- |
| **Priorité** | Should — ajout de périmètre validé par le PO le 13 août |
| **Jalon visé** | **ouvert dès le 1ᵉʳ novembre**, donc fini et testé avant le gel du 1ᵉʳ octobre |
| **Dépendances** | Epic 7 (équipes et classements) · Epic 5 (téléversement d'images) · Epic 8 (back-office) |
| **Stories** | 6 |
| **Statut** | Périmètre et décisions validés — stories rédigées, développement en attente du feu vert |

---

## Objectif

Permettre à une fédération de participer **comme fédération** : une super-équipe
regroupe plusieurs équipes, avec son classement interne et son identité visuelle.

## Valeur livrée

**C'est un levier de recrutement, pas une fonctionnalité de confort.** Le cas
concret est la Table Ronde Française : une fédération de tables locales, qui
sera vraisemblablement le plus gros participant de l'édition. Aujourd'hui elle
ne peut entrer que comme une collection d'équipes sans lien entre elles — ce
qui lui retire précisément ce qui la motive : voir ses tables se comparer entre
elles.

Le logo joue le même rôle un cran plus bas. Une équipe qui porte l'écusson de
son club se reconnaît dans l'application ; une ligne de texte, non.

---

## Ce que le PO a demandé

| Règle | Détail |
| --- | --- |
| Création | **Réservée à l'organisation.** Aucun participant ne crée de super-équipe |
| Composition | Une super-équipe regroupe des équipes. **La gestion des équipes ne change pas** |
| Volume attendu | Une dizaine de super-équipes au maximum |
| Capitaine | **Nommé par l'organisation**, et lui seul |
| Classement | **Interne** : les équipes qui composent la super-équipe, classées entre elles |
| Logo | Pour les équipes **et** pour les super-équipes |

---

## Décisions prises par le PO — 13 août

### S1 — Pas de classement entre super-équipes

Seul le classement interne existe. Un classement opposant une dizaine de
super-équipes de tailles radicalement différentes serait joué d'avance, et il
faudrait le normaliser — or **une normalisation jugée injuste fait plus de mal
que pas de classement du tout** (c'est déjà le raisonnement de la story 7.5).

Conséquence directe : les classements existants ne bougent pas d'une ligne.

### S2 — Le capitaine de super-équipe gère l'apparence

Il peut changer le **logo et la description** de sa super-équipe. Il ne peut
pas toucher à sa composition : rattacher ou détacher une équipe reste un geste
de l'organisation.

Le partage est net et c'est ce qui le rend tenable : **l'apparence est
réversible d'un clic, la composition ne l'est pas** — détacher une équipe par
erreur en plein novembre lui retire son classement interne sans prévenir.

### S3 — Le logo d'équipe est téléversé par le capitaine

L'organisation peut le retirer. Modération **a posteriori**, pas a priori :
valider chaque logo avant affichage retomberait sur trois bénévoles au moment
précis où les inscriptions arrivent en masse, et une équipe sans logo pendant
trois jours est une équipe qui renonce.

Le risque assumé est qu'une image inappropriée soit visible le temps qu'on la
voie. Il est bordé par trois choses : le retrait est immédiat depuis le
back-office, chaque téléversement est journalisé avec son auteur, et le
mécanisme de suspension de la story 8.7 existe déjà pour le cas grave.

---

## Ce que j'ai ajouté aux règles, et pourquoi

Ces points ne figuraient pas dans la demande. Ils sont nécessaires pour que le
mécanisme tienne debout.

### 1. Une équipe appartient à une super-équipe, ou à aucune

Pas à deux. Sans cette règle, une équipe apparaîtrait dans deux classements
internes avec les mêmes points, et « ma table est 3ᵉ » n'aurait plus de
réponse unique.

### 2. Le capitaine de super-équipe est un participant comme un autre

Il a son inscription, son équipe, ses défis. Être capitaine de super-équipe
n'est **pas** un rôle d'administrateur : il ne voit rien de plus que le
classement interne et l'écran d'apparence de sa propre super-équipe.

C'est ce qui permet de nommer un bénévole de la fédération sans lui ouvrir le
back-office — et donc sans lui donner accès aux paiements et aux adresses
postales de six cents personnes.

### 3. Le classement interne réutilise la normalisation existante

Les tables locales n'ont pas la même taille. Le classement interne applique
donc **exactement la même formule** que le classement par équipes de la story
7.5, avec les mêmes réglages en base.

Une seconde formule serait un second débat sur l'équité, et deux règles
différentes dans la même application sont deux règles que personne ne sait
expliquer.

### 4. Aucun plafond technique sur le nombre de super-équipes

Le PO en attend une dizaine. Puisque **seule l'organisation en crée**, le
nombre est contrôlé par construction : ajouter une limite en base ne
protégerait de rien et bloquerait le jour où une onzième fédération se
présente en octobre.

### 5. Le logo a des limites, et elles sont dans la base

Format et poids maximum sont imposés par le stockage, pas seulement par le
formulaire — un formulaire se contourne. Mêmes règles que les visuels de
cartes de la story 5.6, qui sont déjà en place et éprouvées.

### 6. Retirer une super-équipe ne supprime aucune équipe

Le lien se défait, les équipes continuent d'exister avec leurs membres, leurs
points et leur place au classement général. Une suppression qui emporte des
équipes en cascade est une suppression que personne n'ose faire.

---

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 14.1 | Schéma des super-équipes et du rattachement des équipes | M |
| 14.2 | Gestion des super-équipes depuis le back-office | M |
| 14.3 | Classement interne d'une super-équipe | M |
| 14.4 | Logo d'équipe, téléversé par le capitaine | M |
| 14.5 | Logo et description de super-équipe, gérés par son capitaine | S |
| 14.6 | Modération des logos depuis le back-office | M |

---

## Ordre d'exécution

```
14.1 ──┬──► 14.2 ──► 14.3
       │           └──► 14.5
       └──► 14.4 ──► 14.6
```

---

## Critères de sortie

- [ ] Un administrateur crée une super-équipe, y rattache trois équipes et nomme un capitaine.
- [ ] Aucun participant ne peut créer, modifier ou supprimer une super-équipe.
- [ ] Le classement interne montre les trois équipes, avec la **même formule** que le classement général.
- [ ] Une équipe ne peut appartenir qu'à une seule super-équipe — vérifié par un test.
- [ ] Un capitaine d'équipe téléverse un logo ; il s'affiche sur la page de son équipe.
- [ ] Le capitaine de super-équipe change son logo et sa description, et **rien d'autre**.
- [ ] L'organisation retire un logo en un geste, et le retrait est journalisé.
- [ ] Détacher une équipe ne lui fait perdre ni ses membres, ni ses points, ni son rang général.
- [ ] **Aucun classement existant n'a changé** — les tests de l'epic 7 passent sans modification.

---

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| **Une image inappropriée en ligne** | Modération a posteriori assumée (S3), retrait immédiat, téléversement journalisé, suspension possible |
| Un capitaine de super-équipe confondu avec un administrateur | Il ne voit que sa super-équipe ; aucun accès au back-office, aux paiements ni aux adresses |
| Une équipe détachée par erreur | Réservé à l'organisation, journalisé, et sans effet sur l'équipe elle-même |
| Deux formules de classement | Le classement interne réutilise la formule et les réglages de la story 7.5 |
| **Périmètre ajouté après la clôture** | Comme l'epic 12, il se coupe en entier sans rien casser : aucune ligne existante n'en dépend |

---

## Ce que cet epic ne fait pas

- **Pas de classement des super-équipes entre elles** (décision S1).
- **Pas de code d'adhésion à une super-équipe.** On y entre par son équipe, et
  une équipe y est rattachée par l'organisation.
- **Pas de super-équipe imbriquée.** Une seule couche au-dessus des équipes ;
  une hiérarchie à trois niveaux est un besoin que personne n'a exprimé.
- **Pas de recadrage ni de retouche du logo.** Le fichier est affiché tel quel,
  dans un cadre carré. Un éditeur d'image dans le navigateur est un projet à
  lui seul.
