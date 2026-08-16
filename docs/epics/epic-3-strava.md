# Epic 3 — Connexion Strava et synchronisation

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | mi-septembre 2026 |
| **Dépendances** | Epic 1 · **quota Strava relevé** (production uniquement) |
| **Stories** | 9 |

---

## Objectif

Permettre au participant de lier son compte Strava en un minimum de clics, puis récupérer
automatiquement ses activités pendant toute la durée du jeu — dans le respect strict de la
minimisation des données personnelles.

## Valeur livrée

**C'est la brique qui rend tout le reste automatique.** Sans elle, il n'y a pas de jeu :
la saisie manuelle est exclue par principe.

## ⚠️ L'epic le plus risqué du projet

Deux risques externes, qu'**aucune décision technique ne peut lever** :

- **Le quota d'athlètes** d'une application Strava neuve doit être relevé par Strava, sur
  demande, avec un délai non maîtrisé.
- **La conformité de l'usage prévu** — classements entre participants à partir de données
  Strava — doit être confirmée au regard du contrat développeur.

**La story 3.1 est la réponse de découpage à ce risque.** Elle livre un jeu d'activités
simulées, injectables dans le système, qui permet de **développer et tester intégralement
les epics 4, 5, 7 et 9 sans dépendre du déblocage de Strava**. C'est la première story de
l'epic, avant même l'authentification Strava — délibérément.

## Décisions applicables

- **D3 (architecture)** — couche d'abstraction « source d'activité ». L'application ne
  connaît jamais Strava directement. Cette couche existe **dès la première story**, jamais
  ajoutée après coup.
- **D4 (architecture)** — webhooks en réception, rattrapage périodique horaire en filet de
  sécurité.
- **D9 (architecture)** — minimisation dès la réception : **ni tracé GPS, ni fréquence
  cardiaque, ni puissance, ni cadence**.
- Portée demandée : `activity:read_all`, avec consentement explicite et séparé.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 3.1 | **Couche d'abstraction « source d'activité » et jeu d'activités simulées** | M |
| 3.2 | Consentement explicite au traitement des données d'activité | M |
| 3.3 | Connexion OAuth du compte Strava | M |
| 3.4 | Normalisation et minimisation des activités | M |
| 3.5 | Réception des activités par webhook Strava | M |
| 3.6 | Rattrapage périodique et import initial | M |
| 3.7 | Rafraîchissement des jetons et gestion des connexions expirées | M |
| 3.8 | État de la connexion et resynchronisation manuelle côté participant | M |
| 3.9 | Comportement dégradé en cas d'indisponibilité de Strava | M |

## Critères de sortie

- [ ] Un participant lie son compte Strava en moins de trois écrans.
- [ ] Le consentement au traitement des données d'activité est recueilli **avant** la
      redirection vers Strava, et tracé.
- [ ] Une activité créée sur Strava apparaît dans le jeu en quelques secondes.
- [ ] **Aucun tracé GPS ni donnée de santé n'est stocké** — vérifié par un test
      automatisé.
- [ ] Un même compte Strava ne peut être lié qu'à un seul compte de jeu.
- [ ] Une connexion expirée est détectée, notifiée, et rétablissable par le participant.
- [ ] Après une interruption simulée, les activités de la période sont rattrapées
      automatiquement.
- [ ] Les epics suivants peuvent être développés avec le jeu d'activités simulées, sans
      compte Strava réel.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Quota Strava non relevé | Story 3.1 : activités simulées. Les epics 4, 5, 7 et 9 avancent sans blocage |
| Usage non conforme au contrat Strava | La couche D3 limite la portée d'un ajustement, mais **le concept devrait être revu**. Vérification à mener sans délai par le PO |
| Dépassement du quota d'appels | File d'attente avec limitation de débit et reprise progressive, conçue dès la story 3.5 |
