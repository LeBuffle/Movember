# CLAUDE.md — Conventions du projet DEFI Movember

Ce fichier définit les règles de travail du dépôt. Il fait autorité pour tout agent
(BMAD ou Claude Code) intervenant sur le projet.

---

## 1. Le projet en une phrase

Application mobile (PWA) de collecte de fonds au profit de la fondation Movember :
pendant le mois de novembre, les participants payent une inscription, connectent leur
compte Strava, relèvent un défi sportif par jour et collectionnent des cartes sur le
thème sport / moustache.

**Porteur / Product Owner :** Sylvain — non développeur. Le développement est assuré
par l'agent ("vibe coding").

**Cadre :** projet bénévole, non lucratif, porté par une association loi 1901,
indépendant de la fondation Movember (accord obtenu, mais pas d'usage de la marque).

---

## 2. Méthodologie : BMAD

Le projet suit strictement la méthode BMAD (Breakthrough Method for Agile AI-Driven
Development). Enchaînement des agents et des livrables :

| Phase | Agent | Livrable | Gate |
| --- | --- | --- | --- |
| 0 | — | Setup repo + BMAD + `CLAUDE.md` | validation PO |
| 1 | Analyst | `docs/brief.md` | validation PO |
| 2 | PM | `docs/prd.md` | validation PO |
| 3 | Architect | `docs/architecture.md` | validation PO |
| 4 | PO + Scrum Master | `docs/epics/`, `docs/stories/` | validation PO |
| 5 | Dev + QA | code applicatif | feu vert explicite PO |

### Règles de gate — non négociables

1. **Aucun code applicatif** n'est écrit avant que Brief, PRD et Architecture ne soient
   produits **et validés explicitement** par le PO.
2. À la fin de chaque phase : résumé en français, concis, puis **arrêt** en attente de
   validation. Pas d'enchaînement automatique de phase.
3. Chaque phase validée est committée et poussée sur GitHub.
4. Aucune contrainte technique inventée : en cas d'information manquante sur un choix
   structurant, poser la question plutôt que supposer.

---

## 3. Langue

- **Documentation métier, commits, résumés, échanges** : français.
- **Code, noms de variables, commentaires techniques, messages d'API** : anglais.
- **Interface utilisateur (UI)** : français.
- Toute explication destinée au PO doit être compréhensible **sans bagage technique**.
  Pour tout choix technique structurant : expliquer le compromis en langage simple,
  donner une **recommandation claire**, puis laisser le PO trancher.

---

## 4. Stack technique (pressentie — à confirmer en Phase 3)

Rien n'est figé avant le document d'Architecture. Orientation par défaut, alignée sur
les autres projets du PO :

| Brique | Choix par défaut |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript, en PWA installable |
| Styling | Tailwind CSS |
| Backend / BDD / Auth | Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions) |
| Paiement | Stripe (compte au nom de l'association) |
| Hébergement | Vercel (alternative : VPS Hostinger) |
| Intégration sportive | Strava (obligatoire) — Garmin en lot optionnel post-lancement |
| Notifications | Web Push (service worker) + repli e-mail |

**Interdit sans validation :** publication sur les stores (App Store / Play Store),
saisie manuelle des activités sportives, émission de reçus fiscaux / CERFA.

---

## 5. Charte graphique

- Couleurs : **bleu** et **orange**. Thème **sport / moustache**.
- Identité visuelle **propre au projet**.
- **Interdiction stricte** d'utiliser le logo, les visuels ou l'imagerie officielle de
  la fondation Movember.
- Aucun élément d'interface ne doit laisser croire qu'il s'agit de l'application
  officielle de la fondation. Une mention d'indépendance doit être visible.

---

## 6. Mentions légales structurantes

- Les sommes versées sont des **frais d'inscription** et des **achats avec
  contrepartie**, **pas des dons**.
- **Aucun reçu fiscal, aucun CERFA, aucune défiscalisation.** Cela doit être annoncé
  clairement et sans ambiguïté dans l'application et dans les CGV.
- Les fonds sont encaissés par l'association via Stripe ; l'association effectue
  ensuite le don officiel à la fondation Movember. L'application doit fournir une
  **traçabilité comptable exploitable** (encaissements, remboursements, total collecté,
  frais).
- RGPD : les activités sportives (localisation, rythme, santé) sont des données
  personnelles sensibles. Minimisation, consentement, durée de conservation, export et
  suppression de compte sont obligatoires. Marché visé : France / UE.

---

## 7. Structure du dépôt

```
.
├── CLAUDE.md              # ce fichier — conventions du projet
├── README.md
├── .bmad-core/            # agents, templates et workflows BMAD (généré)
├── .claude/commands/      # commandes slash BMAD pour Claude Code (généré)
└── docs/
    ├── brief.md           # Phase 1 — Analyst
    ├── prd.md             # Phase 2 — PM
    ├── architecture.md    # Phase 3 — Architect
    ├── epics/             # Phase 4 — PO
    └── stories/           # Phase 4 — Scrum Master
```

Le code applicatif sera ajouté en Phase 5 selon l'arborescence définie par le document
d'Architecture.

---

## 8. Git — branches et commits

### Branches

| Type | Format | Usage |
| --- | --- | --- |
| Principale | `main` | toujours déployable |
| Fonctionnalité | `feat/<slug-court>` | ex. `feat/strava-oauth` |
| Correction | `fix/<slug-court>` | ex. `fix/webhook-stripe-retry` |
| Documentation | `docs/<slug-court>` | ex. `docs/prd-v1` |
| Technique | `chore/<slug-court>` | outillage, config, CI |

Convention retenue pour un projet solo : **une branche par story BMAD**, une pull
request par branche, fusion en **squash merge** dans `main`. Le PO valide la PR ; pas
de revue par un tiers. `main` est protégée : pas de push direct.

### Messages de commit — Conventional Commits, en français

```
<type>(<scope>): <description à l'impératif, minuscule, sans point final>
```

Types : `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `style`.

Exemples :
```
docs: project brief v1
docs: PRD v1
feat(strava): connexion OAuth du compte sportif
fix(stripe): rejouer les webhooks en échec
chore: init repository
```

Un commit = un changement cohérent. Pas de commit fourre-tout.

---

## 9. Sécurité

- **Aucun secret dans le dépôt.** Clés Stripe, jetons Strava, clés de service Supabase
  et clés VAPID passent exclusivement par des variables d'environnement.
- `.env` est ignoré par git ; seul `.env.example` (sans valeurs) est versionné.
- Les clés secrètes (Stripe secret, Supabase service role) ne sont jamais exposées côté
  navigateur.
- Row Level Security activée sur toutes les tables Supabase contenant des données
  utilisateur.

---

## 10. Critère d'arbitrage permanent

Projet bénévole au profit d'une collecte, avec une **date de lancement non
négociable** (inscriptions mi-octobre, jeu le 1er novembre).

> À qualité égale, privilégier la solution **la moins coûteuse en frais récurrents**,
> **la plus simple à maintenir** et **la plus rapide à livrer**.

Chaque euro de frais technique est un euro en moins pour la collecte.
