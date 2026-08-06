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
| `crontab` | Tâches planifiées — **installé depuis le dépôt à chaque déploiement en production** |
| `scripts/deploy.sh` | Déploiement, avec retour arrière automatique si le conteneur ne démarre pas |
| `scripts/rollback.sh` | Retour arrière manuel, en une commande *(story 1.4)* |
| `scripts/check-resources.sh` | Alerte disque et mémoire, lancée par cron *(story 1.11)* |
| [`../docs/runbook.md`](../docs/runbook.md) | **Que faire quand ça ne va pas — à garder sous la main** |

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
nano .env      # domaines, réseau Traefik

# 2. Variables applicatives — vides pour l'instant, remplies au fil des epics
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

## Mettre la production en ligne

À faire une fois, quand le domaine est prêt.

### 1. Les enregistrements DNS

Deux entrées de type **A**, pointant sur l'adresse IP du VPS :

| Nom | Valeur |
| --- | --- |
| `@` | adresse IP du VPS |
| `www` | adresse IP du VPS |

`www` est servi et redirigé en permanence vers le domaine nu, pour qu'une seule adresse
soit partagée et indexée. **Les deux doivent résoudre avant le premier démarrage** :
Traefik ne peut pas obtenir de certificat pour un nom qui ne pointe nulle part.

Pour vérifier depuis le VPS :

```bash
dig +short defi-movember.fr www.defi-movember.fr
```

Les deux lignes doivent afficher l'adresse IP du serveur.

### 2. Les variables applicatives

```bash
cd /opt/defi-movember/deploy
nano .env.production
```

Comme pour la préproduction, avec deux différences qui comptent :

```
NEXT_PUBLIC_SITE_URL=https://defi-movember.fr
CRON_SECRET=<une longue chaîne aléatoire>
```

Pour engendrer le secret des tâches planifiées :

```bash
openssl rand -base64 32
```

> `CRON_SECRET` est **tout ce qui sépare les routes planifiées de l'internet ouvert**.
> À partir de l'epic 4 elles distribuent les défis du jour et tirent les cartes. Un secret
> court ou deviné, et n'importe qui peut les déclencher : l'application refuse d'ailleurs
> de fonctionner avec un secret de moins de seize caractères.

### 3. Les secrets GitHub

Le déploiement en production applique les migrations depuis GitHub Actions, avant de
toucher aux conteneurs. Il lui faut donc un accès à la base :

| Secret | Où le trouver |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string (URI) |

> Cette chaîne contient le mot de passe de la base. Elle va dans les **secrets GitHub**,
> jamais dans le dépôt ni dans un fichier du serveur.

### 4. Déclarer le domaine à Supabase

**Authentication → URL Configuration**, ajouter `https://defi-movember.fr/**` aux
*Redirect URLs*. Sans cela, les liens de confirmation envoyés depuis la production
retomberont sur l'adresse de la préproduction.

### 5. Démarrer

```bash
docker compose up -d app
```

Puis, une fois `main` fusionnée, chaque fusion déploie la production automatiquement.

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

# 4. Code d'accès à la préproduction
#    Une ligne dans .env.staging, six caractères minimum :
#      ACCESS_CODE=un-code-choisi
#    Il ouvre /acces. La production n'en a jamais.

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

## Le code d'accès à la préproduction

La préproduction n'est pas ouverte au public : elle tourne sur des clés de paiement de
test. Elle demande un **code d'accès** sur `/acces`, puis pose un cookie valable trente
jours.

### Le régler

Dans `deploy/.env.staging` :

```
ACCESS_CODE=un-code-d-au-moins-six-caracteres
```

Puis, sur le VPS :

```bash
cd /opt/defi-movember/deploy
docker compose up -d --force-recreate app-staging
```

> `docker compose restart` ne suffit pas : il relance le processus sans relire le fichier
> d'environnement.

### Pourquoi ce n'est plus un mot de passe du serveur

C'était un mot de passe HTTP posé par Traefik jusqu'au 6 août 2026. Il avait une
conséquence que personne n'avait anticipée : **une application ajoutée à l'écran d'accueil
d'un téléphone ne partage pas le magasin de mots de passe du navigateur**, et n'a plus de
barre d'adresse pour le redemander. Elle répondait `401 Unauthorized` et s'arrêtait là.
La préproduction — seul endroit où l'application installée peut être vérifiée — était donc
le seul endroit où elle ne pouvait pas l'être (story 1.8).

Le même symptôme frappait un navigateur ordinaire ayant mis en cache une mauvaise
combinaison : il la rejouait indéfiniment sans jamais reproposer la fenêtre.

**Ce qu'on accepte en échange** : la protection est passée du serveur à notre code. Un
défaut dans le code ouvrirait la préproduction, là où un défaut dans Traefik ne l'aurait
pas fait. Compromis assumé — cet environnement ne contient que des paiements de test et
des activités inventées, et l'alternative était un environnement que personne ne peut
tester.

L'exclusion des moteurs de recherche, elle, reste posée par Traefik.

### En cas de refus

- **« Ce code n'est pas le bon »** — le code saisi diffère de `ACCESS_CODE`. Attention aux
  espaces en fin de ligne dans le fichier d'environnement.
- **La page `/acces` ne s'affiche pas du tout** — `ACCESS_CODE` fait moins de six
  caractères, ou le conteneur n'a pas été recréé. Vérifier :

  ```bash
  docker compose exec app-staging sh -c 'echo ${#ACCESS_CODE}'
  ```

- **Pour repartir de zéro sur un appareil** : effacer les cookies du site, ou ouvrir une
  fenêtre de navigation privée.

**La production n'a jamais de code.** Le contrôle y est sauté explicitement, quoi que
contienne la variable.

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
