# Plan de démarrage du développement — Sprint 0

| | |
| --- | --- |
| **Version** | v1 — Phase 5 BMAD (handoff Dev) |
| **Date** | 3 août 2026 |
| **Périmètre** | Epic 1 — Fondations et squelette déployable (11 stories) |
| **Jalon visé** | fin août 2026 |
| **Statut** | ⏸️ **En attente du feu vert explicite du PO — aucun code écrit à ce jour** |

---

## 1. Règle de gate

Conformément à `CLAUDE.md` §2, aucun code applicatif n'est écrit avant le **feu vert
explicite** du PO. Le Brief, le PRD, l'Architecture et le Sprint 0 sont validés ; il ne
manque que cette autorisation.

---

## 2. Prérequis à obtenir du PO

| # | Prérequis | Effort PO | Bloque | Urgence |
| --- | --- | --- | --- | --- |
| 1 | **Projet Supabase** — deux projets (préproduction et production), région Francfort, offre gratuite pour l'instant | ~10 min | Stories 1.6, 1.7, 1.10 | Avant le lot C |
| 2 | **Accès au VPS Hostinger** — adresse IP, utilisateur de déploiement, clé SSH, version du système | ~15 min | Stories 1.3, 1.4, 1.11 | **Avant le lot B** |
| 3 | **Nom de domaine** — réservé et pointé vers le VPS | en cours | Confort seulement | Non bloquant |

**Aucun de ces prérequis ne bloque le démarrage.** Le lot A se mène sans rien.

**Ce qu'il ne faut surtout pas faire :** créer un utilisateur `root` pour le déploiement.
Un utilisateur dédié avec les droits Docker suffit, et c'est ce que la story 1.3 attend.

---

## 3. Séquence de livraison

Cinq lots, ordonnés pour que **le premier lot visible par le PO soit déjà présentable**.
Rien ne sert de montrer un site en ligne s'il est encore gris et sans identité.

### Lot A — Socle technique (aucun prérequis)

| Story | Titre |
| --- | --- |
| 1.1 | Initialisation du projet Next.js |
| 1.5 | Charte graphique et composants de base |
| 1.2 | Conteneurisation Docker et reverse proxy |

**Ce que le PO peut valider :** rien en ligne encore, mais la charte bleu / orange existe
et les composants de base sont prêts. Je peux lui montrer des captures d'écran de la page
de démonstration des composants.

**Pourquoi la charte si tôt :** pour que le premier écran qu'il verra en ligne, au lot B,
ait déjà l'identité du jeu.

### Lot B — Le site est en ligne ⭐

| Story | Titre |
| --- | --- |
| 1.3 | Déploiement automatisé vers la préproduction |
| 1.9 | Page d'accueil publique et mentions obligatoires |

**Prérequis : accès au VPS.**

**Ce que le PO peut valider :** il ouvre `staging.<domaine>` sur son téléphone et voit la
page d'accueil du jeu, aux bonnes couleurs, avec les trois niveaux et les mentions légales.

**C'est le jalon le plus important du Sprint 0.** À partir de là, chaque push est
automatiquement visible et validable. Tout le reste du projet devient vérifiable en
continu.

### Lot C — Les comptes

| Story | Titre |
| --- | --- |
| 1.6 | Base de données, schéma initial et sécurité au niveau des lignes |
| 1.7 | Authentification des comptes |

**Prérequis : projets Supabase.**

**Ce que le PO peut valider :** il crée un compte sur la préproduction, se déconnecte, se
reconnecte, réinitialise son mot de passe.

### Lot D — Application installable et espace d'administration

| Story | Titre |
| --- | --- |
| 1.8 | PWA installable |
| 1.10 | Coquille du back-office et rôle administrateur |

**Ce que le PO peut valider :** il **installe l'application sur l'écran d'accueil de son
téléphone** et accède au back-office avec son compte administrateur.

C'est aussi la première vérification concrète de la contrainte iOS : sans installation, pas
de notifications en novembre.

### Lot E — Mise en production et filet de sécurité

| Story | Titre |
| --- | --- |
| 1.4 | Déploiement en production et retour arrière |
| 1.11 | Supervision, alertes et procédure d'exploitation |

**Ce que le PO peut valider :** le site est en ligne sur le domaine de production, il
reçoit une alerte lors d'une coupure de test, et il **exécute lui-même une procédure du
runbook**.

**Pourquoi la production en dernier :** il n'y a rien à mettre en production avant qu'il y
ait quelque chose à montrer au public. La préproduction suffit à tout valider jusque-là.

---

## 4. Méthode de travail

**Une branche par story**, conformément à `CLAUDE.md` §8 :

```
feat/1.1-initialisation-projet
feat/1.5-charte-graphique
chore/1.2-conteneurisation
chore/1.3-deploiement-preproduction
...
```

**Une pull request par story.** Le PO valide, puis squash merge dans `main`.

**Le cycle d'une story :**

```
Story en Draft
  └→ passage en Approved par le PO
       └→ branche créée, développement
            └→ tests écrits et passants
                 └→ pull request + déploiement automatique en préproduction
                      └→ validation du PO sur son téléphone
                           └→ squash merge dans main → story en Done
```

**Ce qui est attendu du PO à chaque story :** ouvrir la préproduction, vérifier que ce
qu'il voit correspond à ce qui était annoncé, et dire oui ou non. Aucune compétence
technique requise.

---

## 5. Définition de « terminé »

Une story n'est `Done` que si **tous** ces points sont vrais :

- [ ] Tous les critères d'acceptation sont satisfaits.
- [ ] Le formatage, le typage et les tests passent en intégration continue.
- [ ] Les tests prévus dans la section *Testing* de la story sont écrits et passants.
- [ ] Aucun secret n'a été introduit dans le dépôt.
- [ ] La sécurité au niveau des lignes est active sur toute nouvelle table.
- [ ] Le changement est visible et vérifié en préproduction.
- [ ] Le PO a validé.

---

## 6. Ce qui avance en parallèle, sans moi

Ces chantiers sont portés par le PO. Ils ne bloquent pas le Sprint 0, mais bloquent le
lancement — et deux d'entre eux sont plus longs qu'ils n'en ont l'air.

| Chantier | Échéance | Conséquence d'un retard |
| --- | --- | --- |
| **Application Strava + relèvement du quota** | immédiat | Epic 3 non livrable en production |
| **Confirmation de conformité auprès de Strava** | immédiat | Le concept lui-même est en jeu |
| **Compte Stripe de l'association** | immédiat | Epic 2 non livrable en production |
| Devis ferme de médaille | avant l'ouverture | Grille de dons non figeable |
| **Catalogue de 60 à 80 défis** | septembre | Epic 4 sans contenu |
| **~50 visuels de cartes** | septembre | Album avec visuels de remplacement |
| CGV, confidentialité, mentions légales | septembre | Epic 11 incomplet, lancement impossible |

---

## 7. Après le Sprint 0

L'epic 2 (inscription payante) enchaîne, avec ses stories rédigées à ce moment-là — le
découpage bénéficiera de ce qu'on aura appris en construisant le socle.

**Une exception à l'ordre des epics mérite d'être signalée :** si le quota Strava tarde,
la **story 3.1** (couche d'abstraction et activités simulées) peut être avancée avant
l'epic 2. Elle débloque les epics 4, 5, 7 et 9, et c'est la seule protection possible
contre ce risque.

---

## 8. Ce qui se passe au feu vert

Dès l'autorisation du PO, dans cet ordre :

1. Passage des stories 1.1, 1.5 et 1.2 en `Approved`.
2. Création de la branche `feat/1.1-initialisation-projet`.
3. Développement de la story 1.1 selon ses critères d'acceptation.
4. Pull request et présentation du résultat au PO.
5. Enchaînement sur 1.5, puis 1.2.

**Aucune ligne de code ne sera écrite avant ce feu vert.**
