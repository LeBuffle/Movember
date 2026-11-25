# Epic 15 — Journal des sorties

| | |
| --- | --- |
| **Priorité** | Should — ajout de périmètre validé par le PO le 13 août |
| **Jalon visé** | **ouvert dès le 1ᵉʳ novembre**, donc fini et testé avant le gel du 1ᵉʳ octobre |
| **Dépendances** | Epic 3 (import des activités) · Epic 7 (classements) · Epic 13 (classements en cartes) |
| **Stories** | 5 |
| **Statut** | **Livré** — les cinq stories sont en Review, en attente de recette PO |

---

## Objectif

Depuis une ligne de classement, voir les dernières sorties de la personne dans
**cette catégorie** — pour comprendre comment elle s'y est prise, et s'en
inspirer.

## Valeur livrée

**Un classement dit qui gagne ; il ne dit jamais comment.** « Il a 340 km de
vélo » ne se traduit pas en quelque chose qu'on peut faire soi-même. « Six
sorties de 55 km le week-end » se traduit tout de suite.

C'est un levier d'assiduité, pas de compétition : ce qui fait revenir au
neuvième jour, c'est de voir qu'un objectif est atteignable, pas de voir un
écart se creuser.

---

## Ce que le PO a demandé

| Règle | Détail |
| --- | --- |
| Déclencheur | Un clic sur la case d'un participant dans le classement |
| Contenu | Ses **dix dernières sorties** de la catégorie consultée |
| Forme | Un dépliant depuis la ligne, sans quitter le classement |
| Intention | Voir comment quelqu'un s'y est pris, s'en inspirer |

---

## Décisions prises par le PO — 13 août

### J1 — Visible par défaut, avec retrait possible

Chacun peut couper l'affichage de ses sorties depuis son profil, en un
interrupteur.

**Un accord préalable aurait été plus prudent et aurait raté sa cible.**
Personne ne trouve un réglage facultatif : la liste serait vide chez la
plupart, et la fonctionnalité n'aurait servi à rien. C'est le même arbitrage
que « ne pas me défier » de l'epic 12, tranché de la même façon.

### J2 — Ni titre, ni trace

Sport, date, distance, durée, dénivelé. Rien d'autre.

Le titre paraît anodin — « fractionné 30/30 » est même utile. Mais c'est un
champ libre : « footing avant le rendez-vous chez le kiné », « tour du lac
depuis chez Marie ». Un lieu, un état de santé, un nom de tiers. Le gain
d'inspiration ne vaut pas ce risque-là.

Aucune trace GPS n'est concernée : **le projet n'en stocke aucune** depuis la
story 3.4 (architecture D9). Il n'y a rien à retirer, seulement à ne pas
commencer.

### J3 — Ce qui est privé sur Strava reste privé ici

L'application demande la portée `activity:read_all`, qui lui donne accès aux
sorties que le participant a **masquées sur Strava**. C'est nécessaire pour
valider ses défis.

Les republier à six cents personnes serait une fuite, pas un réglage : la
personne a explicitement caché cette sortie, et notre autorisation de la lire
n'est pas une autorisation de la montrer.

---

## Ce que j'ai ajouté aux règles, et pourquoi

Ces points ne figuraient pas dans la demande. Ils sont nécessaires pour que le
mécanisme tienne debout.

### 1. Ce qu'on ne sait pas est traité comme privé

Le drapeau « privée » n'existera en base que pour les sorties importées après
la migration. Les précédentes ne disent rien — et **ne rien dire n'est pas
dire non**. Elles sont donc masquées jusqu'à un réimport.

Le contraire aurait publié rétroactivement des sorties dont personne ne peut
affirmer qu'elles étaient publiques.

### 2. Le journal suit la catégorie consultée

Cliquer depuis le classement Vélo montre des sorties à vélo. Montrer toutes
les sorties répondrait à une autre question que celle qui a été posée — et
noierait la seule information cherchée sous les séances de renforcement.

### 3. Dix, sans pagination

L'objectif est de comprendre une manière de faire, pas d'auditer un mois. Dix
lignes suffisent à voir un rythme ; cinquante donnent l'impression d'être
surveillé, des deux côtés de l'écran.

### 4. Le retrait masque, il ne supprime jamais

Quelqu'un qui coupe l'affichage **garde ses points, son rang et ses défis**.
Ses sorties restent en base — elles valident ses défis — et cessent
simplement d'être montrées. Un retrait qui coûterait un classement est un
retrait que personne n'ose.

L'effet est immédiat et rétroactif : il porte sur ce qui est déjà là, pas
seulement sur la suite.

### 5. Rien de tout cela hors connexion

Le journal est réservé aux participants inscrits et actifs de l'édition. Les
classements publics de la galerie n'en montrent rien. Ce qu'on accepte de
partager avec les gens qui jouent avec soi n'est pas ce qu'on accepte de
publier sur le Web.

### 6. Un compte suspendu n'a pas de journal

Comme il n'a déjà pas de rang (story 8.7). La règle existe ; il s'agit de ne
pas la contourner par une porte nouvelle.

---

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 15.1 | Conserver le caractère privé d'une sortie à l'import | M |
| 15.2 | Le réglage « ne pas montrer mes sorties » | M |
| 15.3 | Lecture du journal d'un participant, par catégorie | M |
| 15.4 | Le dépliant depuis une ligne de classement | M |
| 15.5 | Mentions de confidentialité mises à jour | M |

---

## Ordre d'exécution

```
15.1 ──┬──► 15.3 ──► 15.4
15.2 ──┘
15.5 (indépendante, mais à livrer avec le reste)
```

**15.1 et 15.2 avant 15.3, et c'est l'ordre qui protège.** La lecture ne doit
jamais exister avant les deux filtres qu'elle applique : livrée d'abord, elle
montrerait tout de tout le monde le temps d'une préproduction.

---

## Critères de sortie

Cochés = tenus par un test automatique. Les autres se vérifient sur l'application, une
fois la migration 39 appliquée et un réimport lancé.

- [x] Une sortie masquée sur Strava n'apparaît jamais dans un journal.
- [x] Une sortie importée avant la migration n'apparaît pas non plus, faute de savoir.
- [x] Le titre de la sortie n'apparaît nulle part, dans aucune réponse du serveur.
- [x] Couper l'affichage vide le journal **immédiatement**, y compris pour le passé.
- [x] Couper l'affichage n'écrit que dans `profiles` — ni rang, ni points, ni défis.
- [x] Le journal du classement Vélo ne contient que des sorties à vélo.
- [x] Rien n'est lisible sans être un participant inscrit et actif de l'édition.
- [x] Un compte suspendu n'a pas de journal.
- [x] La politique de confidentialité dit ce qui est montré aux autres participants.
- [ ] Vérifié sur l'application, sur un téléphone, avec deux comptes.
- [ ] Un parcours au clavier et au lecteur d'écran.

---

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| **Publier une sortie que son auteur avait cachée** | Drapeau conservé à l'import (J3), et l'inconnu vaut privé (règle 1) |
| **Un titre qui révèle un lieu ou un état de santé** | Le titre n'est jamais rendu par le serveur, pas seulement jamais affiché |
| Quelqu'un qui se sent surveillé | Retrait en un interrupteur, immédiat et rétroactif, sans perdre son rang |
| Une lecture coûteuse à chaque ouverture | Dix lignes, une requête, sur demande — jamais au chargement du classement |
| **Périmètre ajouté après la clôture** | Comme les epics 12 à 14, il se coupe en entier : aucune ligne existante n'en dépend |

---

## Ce que cet epic ne fait pas

- **Pas de trace GPS, pas de carte, pas de fréquence cardiaque.** Le projet
  n'en stocke aucune, et cet epic n'est pas l'occasion de commencer.
- **Pas de commentaire ni de « j'aime ».** Un fil social est un projet à lui
  seul, avec sa modération.
- **Pas d'historique complet.** Dix sorties, sans pagination.
- **Pas de journal des défis d'autrui.** Seules les sorties sont concernées ;
  ce qu'un participant a tiré comme défi reste entre lui et l'organisation.
