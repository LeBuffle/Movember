# Infrastructure — DEFI Movember

Tout ce qui fait tourner l'application sur le VPS Hostinger. Ces fichiers sont
versionnés : le serveur ne doit jamais porter de configuration qui n'existe pas ici.

| Fichier | Rôle |
| --- | --- |
| `Dockerfile` | Image applicative, en trois étapes |
| `docker-compose.yml` | Pile de services : Caddy, production, préproduction, worker |
| `Caddyfile` | Reverse proxy, HTTPS automatique, en-têtes de sécurité |
| `.env.example` | Variables d'infrastructure — modèle, sans valeurs |
| `crontab` | Tâches planifiées *(story 1.4)* |
| `scripts/` | Déploiement et retour arrière *(stories 1.3 et 1.4)* |

---

## Les services

| Service | Rôle | Exposé ? |
| --- | --- | --- |
| `caddy` | Reverse proxy, certificats TLS, en-têtes de sécurité | ports 80 et 443 |
| `app` | Application — production | non, via Caddy uniquement |
| `app-staging` | Application — préproduction, protégée par mot de passe | non, via Caddy uniquement |
| `worker` | File de traitement *(vide jusqu'à l'epic 3)* | non, sous profil |

**La base de données n'est pas ici.** Elle reste chez Supabase : on prend en charge ce
qui est simple et sans état — servir une application web — et on délègue ce qui est
critique et opérationnel.

Production et préproduction tournent **côte à côte sur le même serveur**, dans des
conteneurs séparés, avec des bases et des jeux de clés distincts. Caddy les distingue par
nom de domaine.

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
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'mot-de-passe-choisi'
#    puis reporter le résultat dans STAGING_PASSWORD_HASH

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

# La lancer seule, sans Caddy ni certificats
docker run --rm -p 3000:3000 -e APP_ENVIRONMENT=development defi-movember:local

# Puis vérifier
curl http://localhost:3000/api/health
```

Pour la pile complète, il faut des noms de domaine résolvant vers la machine : Caddy
demande de vrais certificats. C'est donc la préproduction du VPS qui sert d'environnement
de vérification réel (story 1.3), pas le poste de développement.

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
- **Rien n'est publié sur l'hôte** en dehors de Caddy : `app` et `app-staging` ne sont
  joignables que par le réseau interne.
- **La préproduction est protégée** par mot de passe et exclue des moteurs de recherche.
  Elle fonctionne avec les clés de paiement de test : elle ne doit jamais être publiquement
  accessible.
- **La politique de sécurité de contenu autorise encore `unsafe-inline`**, ce qu'impose
  Next.js sans nonce. Son durcissement est une tâche identifiée de la revue de sécurité
  (story 11.8).
