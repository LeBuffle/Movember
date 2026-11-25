# Epic 8 — Back-office d'animation

| | |
| --- | --- |
| **Priorité** | Must — livré par tranches |
| **Jalon visé** | au fil des epics 4 à 9 |
| **Dépendances** | Epic 1 (story 1.10) |
| **Stories** | 8 |

---

## Objectif

Donner à l'équipe organisatrice une autonomie complète sur les défis, les cartes, les
notifications, le fil d'actualité et les participants — depuis un téléphone, sans
compétence technique et sans intervention de développement.

## Valeur livrée

**C'est la promesse centrale de la refonte.** Les quatre éditions précédentes reposaient
sur un suivi manuel qui plafonnait le nombre de participants. Si le back-office n'est pas
réellement autonome, le projet déplace le travail manuel au lieu de le supprimer.

## Un epic transversal, livré par tranches

Cet epic n'est **pas** développé d'un bloc après les autres. Chaque écran est livré avec
la fonctionnalité qu'il pilote :

| Tranche | Livrée avec |
| --- | --- |
| Coquille et rôle administrateur | Epic 1, story 1.10 |
| Gestion du catalogue de défis | Epic 4, story 4.2 |
| Gestion des cartes | Epic 5, story 5.6 |
| Publication au fil d'actualité | Epic 7, story 7.8 |
| Envoi de notifications | Epic 6, story 6.8 |
| Tableau de bord de collecte | Epic 9 |
| File d'arbitrage anti-triche | Epic 9 |

**Les stories listées ci-dessous sont celles qui n'appartiennent à aucun autre epic.**

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 8.1 | Tableau de bord d'accueil de l'administrateur | M |
| 8.2 | Liste et recherche des participants | M |
| 8.3 | Fiche détaillée d'un participant | M |
| 8.4 | Vue d'état du catalogue de défis et alertes | M |
| 8.5 | Prévisualisation d'un défi ou d'une carte avant publication | S |
| 8.6 | Gestion des équipes par l'administrateur | S |
| 8.7 | Suspension ou exclusion d'un participant | S |
| 8.8 | Journal des actions administratives | S |

## Le critère qui compte

> **Un bénévole non technique doit pouvoir créer un défi, publier une carte et envoyer une
> notification depuis son téléphone, sans aide et sans documentation.**

Si ce critère n'est pas tenu, l'epic n'est pas terminé — quel que soit l'état des
fonctionnalités.

## Critères de sortie

- [ ] Tous les écrans d'administration sont utilisables sur un écran de téléphone.
- [ ] L'administrateur retrouve un participant par nom, pseudonyme ou e-mail.
- [ ] La fiche participant montre le niveau, l'état Strava, les défis, les cartes et les
      paiements.
- [ ] L'état du catalogue est visible d'un coup d'œil, avec alerte en cas de rupture
      proche.
- [ ] Les actions sensibles sont journalisées avec leur auteur.
- [ ] Un test d'utilisabilité est mené **avec le PO lui-même**, sur son téléphone, avant
      le gel des fonctionnalités.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Back-office construit pour un développeur, pas pour un bénévole | Test d'utilisabilité avec le PO avant le gel ; écrans courts, formulaires simples, prévisualisation |
| Livré trop tard pour être éprouvé | Livraison par tranches dès l'epic 4 : chaque écran est utilisé dès qu'il existe |
