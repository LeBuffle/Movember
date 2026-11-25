# Epic 1 — Fondations et squelette déployable

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | fin août 2026 |
| **Dépendances** | Accès au VPS · nom de domaine · projet Supabase |
| **Stories** | 11 |

---

## Objectif

Mettre en place le socle complet du projet : une application Next.js conteneurisée,
déployée automatiquement sur le VPS avec une préproduction accessible au PO, installable
comme application sur téléphone, avec une base de données sécurisée, l'authentification
des comptes, la charte graphique et une page d'accueil publique.

## Valeur livrée

À la fin de cet epic, **le site existe vraiment** : le PO peut l'ouvrir sur son téléphone,
l'installer sur son écran d'accueil, créer un compte et voir la page d'accueil aux
couleurs du jeu. Toutes les fonctionnalités suivantes viendront s'y greffer par incréments
visibles, sans jamais avoir à refaire le socle.

C'est aussi l'epic qui **rend le circuit de validation possible** : sans préproduction
déployée automatiquement, le PO ne peut rien valider, et les dix autres epics avancent à
l'aveugle.

## Exigences couvertes

FR1, FR3, FR4, FR5, FR21, FR22, FR91, FR104 · NFR1, NFR2, NFR3, NFR8, NFR9, NFR10, NFR13,
NFR21, NFR24, NFR27, NFR28

## Stories

| # | Titre | Valeur |
| --- | --- | --- |
| [1.1](../stories/1.1.initialisation-projet.md) | Initialisation du projet Next.js | Le projet tourne en local |
| [1.2](../stories/1.2.conteneurisation.md) | Conteneurisation Docker et reverse proxy | L'application tourne en conteneur, comme en production |
| [1.3](../stories/1.3.deploiement-preproduction.md) | Déploiement automatisé vers la préproduction | **Le site est en ligne, visible sur téléphone** |
| [1.4](../stories/1.4.deploiement-production.md) | Déploiement en production et retour arrière | Mise en production maîtrisée et réversible |
| [1.5](../stories/1.5.charte-graphique.md) | Charte graphique et composants de base | L'identité bleu / orange existe et est réutilisable |
| [1.6](../stories/1.6.base-de-donnees.md) | Base de données, schéma initial et RLS | Les données sont structurées et protégées |
| [1.7](../stories/1.7.authentification.md) | Authentification des comptes | Un utilisateur peut créer un compte et se connecter |
| [1.8](../stories/1.8.pwa-installable.md) | PWA installable | L'application s'installe sur l'écran d'accueil |
| [1.9](../stories/1.9.page-accueil-publique.md) | Page d'accueil publique et mentions obligatoires | Le projet est présentable au public |
| [1.10](../stories/1.10.coquille-back-office.md) | Coquille du back-office et rôle administrateur | L'espace d'administration existe et est protégé |
| [1.11](../stories/1.11.supervision-runbook.md) | Supervision, alertes et procédure d'exploitation | Le serveur est surveillé et le PO sait quoi faire |

## Séquencement

```
1.1 ──► 1.2 ──► 1.3 ──► 1.4
                 │
                 ├──► 1.5 ──► 1.9
                 ├──► 1.6 ──► 1.7 ──► 1.10
                 ├──► 1.8
                 └──► 1.11
```

Les stories 1.1 à 1.3 sont strictement séquentielles : elles amènent le site en ligne.
Ensuite, 1.5, 1.6, 1.8 et 1.11 peuvent être menées dans l'ordre qui arrange.

## Critères de sortie

- [ ] Le site est accessible en HTTPS sur `staging.<domaine>` et sur le domaine de
      production.
- [ ] Un push sur la branche de travail déploie automatiquement la préproduction.
- [ ] Une fusion dans `main` déploie la production, migrations comprises, avec retour
      arrière possible en moins d'une minute.
- [ ] L'application s'installe sur l'écran d'accueil d'un iPhone et d'un Android.
- [ ] Un utilisateur peut créer un compte, se connecter, se déconnecter et réinitialiser
      son mot de passe.
- [ ] La sécurité au niveau des lignes est active sur toutes les tables créées.
- [ ] La page d'accueil affiche la charte bleu / orange, la mention d'indépendance et la
      mention d'absence de reçu fiscal.
- [ ] Le back-office est accessible aux seuls comptes administrateurs.
- [ ] Une indisponibilité du site déclenche une alerte.
- [ ] `docs/runbook.md` existe et décrit les gestes d'exploitation de base.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Les accès au VPS ne sont pas disponibles à temps | Les stories 1.1, 1.2, 1.5, 1.6 et 1.8 se mènent sans le serveur. Seules 1.3, 1.4 et 1.11 sont bloquées |
| Le nom de domaine n'est pas réservé | Déploiement possible sur l'adresse IP du VPS en attendant, le domaine s'ajoute ensuite |
| Configuration HTTPS et reverse proxy plus longue que prévu | Caddy gère les certificats automatiquement ; c'est précisément pourquoi il a été retenu |
