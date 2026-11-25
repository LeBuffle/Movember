# Epic 11 — Conformité, durcissement et lancement

| | |
| --- | --- |
| **Priorité** | Must |
| **Jalon visé** | **avant le gel des fonctionnalités du 1ᵉʳ octobre** |
| **Dépendances** | Tous les epics précédents |
| **Stories** | 10 |

---

## Objectif

Rendre le projet réellement lançable : conformité RGPD complète, documents légaux,
accessibilité, sauvegardes vérifiées, et répétition générale sur données de test.

## Valeur livrée

**C'est l'epic qui fait la différence entre « ça marche sur mon écran » et « on peut
ouvrir les inscriptions ».** C'est aussi celui qu'on sacrifie par manque de temps sur les
projets qui échouent le jour du lancement.

## La répétition générale

La story 11.9 est la plus importante de l'epic. Une semaine avant l'ouverture des
inscriptions, **une édition de test complète est jouée sur la préproduction avec un mois
compressé en une journée** : inscriptions, connexions Strava, attribution de défis,
évaluation, cartes, classements, notifications, export comptable.

C'est le seul moyen de découvrir en octobre ce qu'on découvrirait sinon le 2 novembre —
quand 600 personnes attendent leur défi du jour.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 11.1 | Export des données personnelles par l'utilisateur | M |
| 11.2 | Suppression de compte, purge et révocation Strava | M |
| 11.3 | Déconnexion de Strava sans suppression du compte | M |
| 11.4 | Politique de conservation et purge automatique après l'édition | M |
| 11.5 | Sauvegardes automatisées et **restauration testée** | M |
| 11.6 | Pages légales : CGV, confidentialité, mentions légales | M |
| 11.7 | Revue d'accessibilité des parcours public et participant | S |
| 11.8 | Durcissement du serveur et revue de sécurité | M |
| 11.9 | **Répétition générale sur données de test** — dont mesure de la consommation mémoire réelle, puis pose de limites informées sur les conteneurs | M |
| 11.10 | Procédure d'exploitation complète (`docs/runbook.md`) | M |

## Points d'attention RGPD

- Le consentement au traitement des données d'activité est **explicite et séparé** de
  l'acceptation des CGV, recueilli avant la connexion Strava.
- Les lignes comptables ne peuvent pas être supprimées — obligation légale. Elles sont
  **anonymisées** : le lien vers le profil est rompu, le montant et la date subsistent.
  Ce point doit figurer explicitement dans la politique de confidentialité.
- Les adresses de livraison sont purgées 3 mois après l'expédition.
- Le registre des traitements est fourni à l'association.

## Points d'attention légaux

- Les CGV doivent énoncer **sans ambiguïté** que les sommes versées sont des frais
  d'inscription et des achats avec contrepartie, **pas des dons ouvrant droit à réduction
  d'impôt**, et qu'aucun reçu fiscal ne sera émis.
- ~~La politique de remboursement doit être arrêtée (point P6 du PRD) avant l'ouverture.~~
  ✅ Tranchée le 11 août et écrite à l'article 10 des CGV.
- La mention d'indépendance vis-à-vis de la fondation Movember doit être visible.

## Critères de sortie

- [ ] Un utilisateur exporte ses données et supprime son compte, jeton Strava révoqué
      auprès de Strava.
- [ ] **Une sauvegarde a été effectivement restaurée** sur la préproduction — pas
      seulement configurée.
- [ ] CGV, politique de confidentialité et mentions légales sont en ligne et relues par le
      PO.
- [ ] Le durcissement du serveur est vérifié : pare-feu, SSH par clé, mises à jour
      automatiques.
- [ ] La répétition générale s'est déroulée de bout en bout, incidents corrigés.
- [ ] `docs/runbook.md` a été **testé par le PO lui-même**, pas seulement écrit.
- [ ] Le basculement de Stripe en mode réel est vérifié.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Epic sacrifié faute de temps | Jalon fixé **avant** le gel du 1ᵉʳ octobre, pas après. C'est la dernière chose à couper, pas la première |
| Documents légaux non rédigés | Chantier de contenu porté par le PO en septembre, signalé dans l'index des epics |
| Répétition générale révélant un défaut majeur | C'est exactement son rôle. La mener **une semaine avant** l'ouverture laisse le temps de corriger |
