# DEFI Movember

Application mobile (PWA) de collecte de fonds au profit de la fondation Movember.

Pendant le mois de novembre, les participants payent une inscription, connectent leur
compte Strava, relèvent un défi sportif par jour et collectionnent des cartes sur le
thème sport / moustache.

> ⚠️ Projet indépendant porté par une association loi 1901. Ce n'est **pas**
> l'application officielle de la fondation Movember et aucune imagerie officielle
> Movember n'est utilisée.

## État du projet

Phase 5 — développement en cours. Brief, PRD, Architecture et Sprint 0 sont validés.

Epic 1 (Fondations et squelette déployable) : stories 1.1, 1.2, 1.3, 1.5, 1.6, 1.7 et
1.8 en revue. Restent 1.4, 1.9, 1.10 et 1.11.

## Démarrage rapide

**Prérequis :** Node.js 22 ou supérieur.

```bash
npm install                # installer les dépendances
cp .env.example .env.local # créer sa configuration locale
npm run dev                # démarrer sur http://localhost:3000
```

Le fichier `.env.local` n'a besoin d'aucune valeur pour lancer le projet en l'état :
les intégrations (Supabase, Stripe, Strava) arrivent avec leurs stories respectives.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm start` | Servir le build de production |
| `npm run check` | **Vérification complète** : formatage, lint, typage, tests |
| `npm run format` | Formater le code |
| `npm run lint` | Analyse statique |
| `npm run typecheck` | Vérification des types |
| `npm test` | Tests unitaires |
| `npm run test:watch` | Tests en continu |
| `npm run test:coverage` | Tests avec couverture |

`npm run check` est la commande exécutée par l'intégration continue. Elle doit passer
avant toute pull request.

## Structure

```
src/
├── app/            # pages et routes (App Router)
│   ├── api/        # routes serveur : webhooks, tâches planifiées, santé
│   ├── manifest.ts # manifeste PWA, servi sur /manifest.webmanifest
│   └── sw.ts       # service worker, compilé vers public/sw.js au build
├── components/     # composants d'interface
├── lib/            # logique métier et intégrations
├── types/          # types partagés
└── styles/
public/icons/       # jeu d'icônes, généré par scripts/generate-icons.mjs
scripts/            # outillage ponctuel, hors chaîne de build
tests/unit/         # tests unitaires (Vitest)
docs/               # documentation BMAD
deploy/             # infrastructure (Docker, Traefik, scripts de déploiement)
```

## Application installable (PWA)

L'application s'installe sur l'écran d'accueil d'un téléphone. C'est une exigence
technique et pas seulement de confort : **sur iPhone, les notifications ne fonctionnent
que si l'application a été ajoutée à l'écran d'accueil.**

Deux choses méritent d'être connues avant d'y toucher :

- **Le service worker ne met en cache qu'une liste blanche** — fichiers de build et
  icônes, rien d'autre (`src/lib/pwa/cache-policy.ts`). Aucune page, aucune réponse
  d'API : les activités Strava d'un participant ne doivent pas survivre dans le cache
  d'un téléphone perdu ou partagé. Un test échoue si cette règle est élargie.
- **Le service worker est désactivé en développement.** Il se vérifie sur la
  préproduction, qui est de toute façon ce que l'on teste sur un vrai téléphone.

Les icônes sont générées à partir d'une seule source vectorielle. Après un changement
de couleur de marque ou de logo :

```bash
npm install --no-save sharp
node scripts/generate-icons.mjs
```

## Point de santé

`GET /api/health` renvoie l'état de l'application, sa version et l'horodatage. Il est
consommé par le contrôle de santé Docker, la chaîne de déploiement et la supervision.

## Exécution conteneurisée

L'application tourne en conteneur Docker derrière un reverse proxy Caddy, sur le VPS.

```bash
docker build -f deploy/Dockerfile -t defi-movember:local .
docker run --rm -p 3000:3000 -e APP_ENVIRONMENT=development defi-movember:local
```

La pile complète (Caddy, production, préproduction) et son installation sur le serveur
sont décrites dans [`deploy/README.md`](deploy/README.md).

## Sécurité

**Aucun secret ne doit être committé.** Toutes les clés passent par des variables
d'environnement. Seul `.env.example` est versionné, et il ne contient que des noms de
variables. Voir [`CLAUDE.md`](CLAUDE.md) §9.

## Documentation

| Document | Chemin | Statut |
| --- | --- | --- |
| Project Brief | [`docs/brief.md`](docs/brief.md) | ✅ validé (v1.1) |
| PRD | [`docs/prd.md`](docs/prd.md) | ✅ validé (v1.1) |
| Architecture | [`docs/architecture.md`](docs/architecture.md) | ✅ validé (v1.1) |
| Epics | [`docs/epics/`](docs/epics/) | ✅ validés |
| Stories | [`docs/stories/`](docs/stories/) | Epic 1 détaillé |
| Plan de démarrage | [`docs/plan-demarrage-dev.md`](docs/plan-demarrage-dev.md) | ✅ validé |

Les conventions de travail (stack, branches, commits, charte graphique) sont décrites
dans [`CLAUDE.md`](CLAUDE.md).

## Calendrier

| Jalon | Date |
| --- | --- |
| Gel des fonctionnalités | ~1er octobre |
| Ouverture des inscriptions | mi-octobre |
| Lancement du jeu | 1er novembre |
| Clôture du jeu | 30 novembre |

## Licence

Projet associatif non lucratif. Tous droits réservés.
