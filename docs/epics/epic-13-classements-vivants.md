# Epic 13 — Classements vivants

| | |
| --- | --- |
| **Priorité** | Should — refonte d'un écran déjà livré |
| **Jalon visé** | avant le 1ᵉʳ novembre |
| **Dépendances** | Epic 7 (classements) |
| **Stories** | 6 |
| **Statut** | Périmètre validé — stories rédigées, développement en attente du feu vert |

---

## Objectif

Faire des classements un écran qu'on rouvre plusieurs fois par jour, au lieu d'une liste
qu'on consulte une fois.

## Valeur livrée

**Les classements sont l'écran le plus ouvert du jeu après le défi du jour**, et le seul
où un participant se compare aux autres. Aujourd'hui ils répondent à la question « qui est
premier ». Ils ne répondent pas à celle qu'on se pose vraiment le matin : **« est-ce que
j'ai bougé cette nuit ? »**

C'est aussi le point de départ naturel de l'epic 12 : on défie quelqu'un qu'on vient de
voir passer devant soi.

---

## Ce que le PO a demandé

| Demande | Traduction |
| --- | --- |
| Un format de cartes plutôt qu'une liste | Chaque participant sur sa propre carte, lisible au pouce |
| Médailles or, argent, bronze | Les trois premiers distingués visuellement, à côté du pseudonyme |
| Un podium provisoire | Les trois premiers mis en scène au-dessus du reste |
| Voir la progression | « +3 places », « −5 places » depuis un point de référence |
| Chercher un joueur par pseudonyme | Retrouver quelqu'un sans faire défiler huit cents lignes |

---

## Le point technique qui décide de tout : depuis quand ?

**« Il a pris 3 places » n'a aucun sens sans un point de comparaison**, et ce point de
comparaison n'existe nulle part aujourd'hui. La vue matérialisée de la story 7.3 ne connaît
que le classement de maintenant.

Trois façons de s'en donner un :

| Approche | Coût | Ce qu'on peut dire |
| --- | --- | --- |
| **Photographie quotidienne** *(recommandé)* | Une table, une ligne par participant et par jour, écrite par la tâche du matin | « depuis hier matin » |
| Colonne `rang_precedent` | Presque rien | « depuis le dernier rafraîchissement », soit un quart d'heure — donc sans intérêt |
| Historique complet | Une ligne par participant et par rafraîchissement, ~2 900 par personne sur le mois | « depuis n'importe quand », mais pour un besoin que personne n'a |

La photographie quotidienne coûte 800 lignes par jour, 24 000 sur l'édition — une paille —
et donne exactement la phrase attendue : **« depuis hier »**. C'est aussi la seule des
trois qui reste vraie si la tâche de rafraîchissement saute une fois.

> **Le repère doit être écrit, pas déduit.** « +3 places » sans savoir depuis quand est une
> information qu'on croit comprendre et qu'on interprète de travers. L'écran dira « depuis
> hier matin », et la photographie sera prise au même moment que la distribution des défis.

---

## Ce que j'ajoute, et pourquoi

### Un podium seulement quand il veut dire quelque chose

Un podium le 1ᵉʳ novembre à 6 h du matin met en scène trois personnes qui n'ont rien fait
de plus que les autres — et fige une hiérarchie sur du hasard. Le podium n'apparaît qu'à
partir d'un écart réel entre le troisième et le quatrième.

### La recherche trouve, même hors de l'écran

Chercher « Moustachu » alors qu'il est 342ᵉ doit **afficher sa carte avec son rang**, pas
répondre « aucun résultat sur cette page ». C'est la différence entre une recherche et un
filtre — et le filtre est ce que tout le monde livre par accident.

### « Vous » est toujours visible

Le participant doit voir sa propre carte sans la chercher, même s'il est 500ᵉ : épinglée en
haut, ou marquée dans la liste. C'est la seule ligne qui l'intéresse vraiment.

### Rien de tout cela ne change un calcul

**Les classements restent ceux de l'epic 7**, au chiffre près. Cet epic touche l'affichage,
la photographie quotidienne et la recherche. Aucune règle de points, aucune source de
carte, aucun seuil ne bouge — et c'est ce qui le rend sans danger.

---

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 13.1 | Photographie quotidienne des rangs | M |
| 13.2 | Classements en cartes plutôt qu'en liste | M |
| 13.3 | Médailles et podium provisoire | S |
| 13.4 | Progression depuis la veille | M |
| 13.5 | Recherche d'un joueur par pseudonyme | S |
| 13.6 | Ma position, toujours visible | S |

---

## Ordre d'exécution

```
13.1 ──► 13.4
13.2 ──┬──► 13.3
       ├──► 13.5
       └──► 13.6
```

13.1 et 13.2 sont indépendantes et se mènent en parallèle : l'une est une tâche de fond,
l'autre est de l'affichage.

---

## Critères de sortie

- [ ] Les huit classements s'affichent en cartes, lisibles sur un téléphone tenu d'une main.
- [ ] Les trois premiers portent une médaille, et le podium n'apparaît que s'il a du sens.
- [ ] La progression indique **depuis quand** elle est mesurée.
- [ ] Chercher un pseudonyme le trouve **même hors de la page affichée**.
- [ ] Un participant voit sa propre position sans la chercher.
- [ ] **Les chiffres sont identiques à ceux d'avant la refonte** — vérifié sur un jeu de test.

---

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Un format de cartes fait défiler trois fois plus | Carte compacte : une ligne de haut, pas une vignette. Le podium est la seule exception |
| La photographie manque un jour | La progression affiche « — » plutôt qu'un chiffre faux. Un `+0` inventé est pire qu'un tiret |
| La recherche expose des pseudonymes | Ils sont déjà publics : c'est tout l'objet d'un classement |
| **Une refonte casse un calcul juste** | Aucune règle de points n'est touchée. Les tests de l'epic 7 restent la référence et doivent passer sans être modifiés |
