# Infrastructure — DEFI Movember

Tout ce qui fait tourner l'application sur le VPS Hostinger. Ces fichiers sont
versionnés : le serveur ne doit jamais porter de configuration qui n'existe pas ici.

| Fichier | Rôle |
| --- | --- |
| [`ACCES-VPS.md`](ACCES-VPS.md) | **Procédure de mise en place des accès — à lire en premier** |
| `Dockerfile` | Image applicative, en trois étapes |
| `docker-compose.yml` | Pile de services : production, préproduction, worker — branchés sur le Traefik du VPS |
| `.env.example` | Variables d'infrastructure — modèle, sans valeurs |
| `scripts/bootstrap-vps.sh` | Préparation initiale du serveur, à lancer une fois |
| `crontab` | Tâches planifiées *(story 1.4)* |
| `scripts/deploy.sh` | Déploiement et retour arrière *(stories 1.3 et 1.4)* |

---

## Les services

| Service | Rôle | Exposé ? |
| --- | --- | --- |
| `app` | Application — production | non, via Traefik uniquement |
| `app-staging` | Application — préproduction, protégée par mot de passe | non, via Traefik uniquement |
| `worker` | File de traitement *(vide jusqu'à l'epic 3)* | non, sous profil |

**Le reverse proxy n'appartient pas à ce projet.** Le VPS fait déjà tourner Traefik, qui
détient les ports 80 et 443 et les certificats de tous les projets de la machine. DEFI
Movember s'y branche par des étiquettes Docker plutôt que d'installer un second proxy :
un seul point d'entrée, un seul magasin de certificats, aucun conflit de port.

**La base de données n'est pas ici.** Elle reste chez Supabase : on prend en charge ce
qui est simple et sans état — servir une application web — et on délègue ce qui est
critique et opérationnel.

Production et préproduction tournent **côte à côte sur le même serveur**, dans des
conteneurs séparés, avec des bases et des jeux de clés distincts. Traefik les distingue
par nom de domaine.

---

## Premier essai, sans domaine

Pour vérifier que Docker fonctionne et voir le site tourner avant d'avoir un nom de
domaine :

```bash
git clone https://github.com/LeBuffle/Movember.git /opt/defi-movember
cd /opt/defi-movember/deploy
docker compose -f docker-compose.first-run.yml up -d --build
```

Le site répond alors sur `http://ADRESSE_IP_DU_VPS:3000`.

**Si le port 3000 est déjà occupé** — le VPS héberge peut-être d'autres projets :

```bash
# Voir ce qui l'utilise
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -tlnp | grep :3000

# Puis démarrer sur un autre port, sans rien arrêter
FIRST_RUN_PORT=3100 docker compose -f docker-compose.first-run.yml up -d
```

Pour l'arrêter :

```bash
docker compose -f docker-compose.first-run.yml down
```

> ⚠️ **Cette configuration n'est pas faite pour la production** : HTTP sans chiffrement,
> port ouvert sans reverse proxy, aucun en-tête de sécurité. Elle sert à valider la chaîne
> Docker, puis à être arrêtée.

---

## Première mise en ligne

À faire **une seule fois**, sur le VPS, avant que le déploiement automatique puisse
fonctionner.

```bash
cd /opt/defi-movember && git pull
sudo bash deploy/scripts/bootstrap-vps.sh   # si ce n'est pas déjà fait
cd deploy

# 1. Configuration de l'infrastructure
cp .env.example .env
nano .env      # domaines, réseau Traefik, mot de passe de la préproduction

# 2. Mot de passe de la préproduction
#    Le | sed double les $ : sans lui, Docker Compose tronque le hash et
#    l'authentification devient impossible, sans message d'erreur.
docker run --rm httpd:alpine htpasswd -nbB po 'mot-de-passe-choisi' | sed -e 's/\$/\$\$/g'
#    → reporter le résultat dans STAGING_BASIC_AUTH

# 3. Variables applicatives — vides pour l'instant, remplies au fil des epics
cp ../.env.example .env.production
cp ../.env.example .env.staging

# 4. Restreindre l'accès à ces fichiers
chmod 600 .env .env.production .env.staging

# 5. Arrêter l'essai temporaire, qui n'a plus lieu d'être
docker compose -f docker-compose.first-run.yml down
```

À partir de là, **chaque push sur la branche de travail déploie automatiquement la
préproduction**. Pour lancer un déploiement à la main :

```bash
bash deploy/scripts/deploy.sh <sha-du-commit> staging
```

---

## Renseigner les clés Supabase

Les clés ne sont **jamais** dans le dépôt : elles vivent uniquement dans les fichiers
d'environnement du serveur.

### Où les trouver

Dans Supabase → **Project Settings → API** :

| Dans Supabase | Variable |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` *(ou « Publishable key »)* | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` *(ou « Secret key »)* | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ La clé `service_role` **contourne toute la sécurité de la base**. Elle ne doit
> jamais être exposée au navigateur ni committée. Le code garantit qu'elle n'est utilisée
> que côté serveur, mais le fichier qui la contient doit rester en `chmod 600`.

### Les renseigner

```bash
cd /opt/defi-movember/deploy
nano .env.staging
```

Quatre lignes à remplir :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://staging.defi-movember.fr
```

### Autoriser le navigateur à joindre Supabase

**Étape facile à oublier**, et son symptôme est déroutant : le site s'affiche mais aucune
donnée ne charge, sans message d'erreur visible. La politique de sécurité de contenu
bloque par défaut toute connexion sortante non déclarée.

```bash
nano .env
```

```
CSP_CONNECT_SRC=https://xxxxxxxx.supabase.co wss://xxxxxxxx.supabase.co
```

*(`wss://` sert aux mises à jour en temps réel, utilisées plus tard par les classements.)*

### Appliquer

```bash
chmod 600 .env .env.staging
docker compose up -d app-staging
```

Les fichiers d'environnement sont lus au démarrage du conteneur : un redémarrage suffit,
sans reconstruire l'image.

---

## Installation sur le serveur

```bash
# 1. Récupérer le dépôt
git clone <dépôt> /opt/defi-movember
cd /opt/defi-movember/deploy

# 2. Créer les fichiers de configuration
cp .env.example .env                      # domaines, certificats, protection préprod
cp ../.env.example .env.production        # variables applicatives — production
cp ../.env.example .env.staging           # variables applicatives — préproduction

# 3. Les renseigner, puis les restreindre
chmod 600 .env .env.production .env.staging

# 4. Générer le mot de passe de la préproduction
#    Le | sed double les $, sans quoi Docker Compose tronque le hash
#    et l'authentification devient impossible sans message d'erreur.
docker run --rm httpd:alpine htpasswd -nbB po 'mot-de-passe-choisi' | sed -e 's/\$/\$\$/g'
#    puis reporter le résultat dans STAGING_BASIC_AUTH

# 5. Démarrer
docker compose up -d
```

> ⚠️ **Aucun de ces fichiers d'environnement n'est versionné.** Ils vivent uniquement sur
> le serveur, en lecture réservée à leur propriétaire.

---

## Vérification en local

Le daemon Docker est nécessaire.

```bash
# Construire l'image
docker build -f deploy/Dockerfile -t defi-movember:local .

# La lancer seule, sans reverse proxy ni certificats
docker run --rm -p 3000:3000 -e APP_ENVIRONMENT=development defi-movember:local

# Puis vérifier
curl http://localhost:3000/api/health
```

Pour la pile complète, il faut des noms de domaine résolvant vers le VPS et le Traefik
qui y tourne : les certificats sont réels. C'est donc la préproduction du VPS qui sert
d'environnement de vérification (story 1.3), pas le poste de développement.

---

## Commandes courantes

```bash
docker compose ps                      # état des services
docker compose logs -f app             # journaux de la production
docker compose logs -f app-staging     # journaux de la préproduction
docker compose restart app             # redémarrer la production
docker compose pull && docker compose up -d   # appliquer une nouvelle image
```

La procédure complète d'exploitation — redémarrer, restaurer, revenir en arrière — sera
dans `docs/runbook.md` (story 1.11).

---

## Points de sécurité

- **Aucun secret dans les images.** Tout est injecté à l'exécution depuis les fichiers
  d'environnement du serveur. Le `.dockerignore` exclut les fichiers `.env` du contexte de
  build, pour qu'ils ne puissent pas se retrouver dans une couche d'image.
- **Conteneurs sans privilèges.** L'application tourne sous un utilisateur dédié, jamais
  `root`.
- **Aucun port n'est publié sur l'hôte** : `app` et `app-staging` ne sont joignables que
  par le réseau Docker de Traefik.
- **La préproduction est protégée** par mot de passe et exclue des moteurs de recherche.
  Elle fonctionne avec les clés de paiement de test : elle ne doit jamais être publiquement
  accessible.
- **La politique de sécurité de contenu autorise encore `unsafe-inline`**, ce qu'impose
  Next.js sans nonce. Son durcissement est une tâche identifiée de la revue de sécurité
  (story 11.8).
- **Le réseau Traefik est déclaré `external`** : cette pile ne peut ni le créer ni le
  supprimer. Rien de ce qui est fait ici ne peut perturber les services déjà en place sur
  le VPS.
