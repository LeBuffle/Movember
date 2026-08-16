# Donner accès au VPS — procédure

Document destiné au Product Owner. Aucune compétence technique supposée : chaque commande
est à copier telle quelle.

---

## En une phrase

**Vous ne me donnez aucun accès.** Vous créez un compte de déploiement sur votre serveur,
et vous confiez sa clé à **GitHub**, qui déploiera automatiquement à chaque validation.

---

## Pourquoi je ne dois pas avoir vos accès

Trois raisons, dans l'ordre d'importance.

**1. Je ne peux techniquement pas m'en servir.** Mon environnement d'exécution n'a pas de
client SSH et le port 22 sortant est bloqué. Une clé transmise ici serait inutilisable —
et exposée pour rien.

**2. Ce n'est pas ce que prévoit l'architecture.** Le déploiement retenu en Phase 3 est :

```
vous validez une modification
   └→ GitHub Actions construit l'image et se connecte au VPS
        └→ le serveur récupère l'image et redémarre
```

C'est **GitHub** qui a besoin de la clé, pas moi. Je n'écris que le programme qui utilise
cette clé ; je ne la vois jamais.

**3. Une clé privée ne se colle jamais dans une conversation.** Ni ici, ni dans un e-mail,
ni dans le dépôt. Elle ne va qu'à un seul endroit : le coffre à secrets de GitHub, qui la
chiffre et ne la réaffiche jamais — même à vous.

---

## Ce que vous allez faire — 4 étapes, environ 15 minutes

### Étape 1 — Générer la clé, sur VOTRE ordinateur

Pas sur le serveur : la clé privée ne doit jamais y être créée ni stockée.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/defi-movember-deploy -N "" -C "github-actions"
```

Deux fichiers apparaissent :

| Fichier | Nature | Où il va |
| --- | --- | --- |
| `defi-movember-deploy.pub` | **publique** — se partage sans risque | sur le serveur |
| `defi-movember-deploy` | **privée** — un secret | dans GitHub, et nulle part ailleurs |

Affichez la clé **publique** et copiez la ligne entière (elle commence par `ssh-ed25519`) :

```bash
cat ~/.ssh/defi-movember-deploy.pub
```

### Étape 2 — Préparer le serveur

Connectez-vous à votre VPS (par SSH ou par la console web Hostinger), puis :

```bash
cd /opt/defi-movember && git pull
sudo bash deploy/scripts/bootstrap-vps.sh
```

Le script demande d'abord confirmation en affichant le nom de la machine, puis **vous
invite à coller la clé publique** de l'étape 1. Il crée l'utilisateur `deploy`, lui donne
accès à Docker, enregistre la clé et prépare le dossier applicatif.

> **Pourquoi pas `ssh-copy-id` ?** C'est la question naturelle, et la réponse explique tout
> le reste. Le compte `deploy` est créé **sans mot de passe** — c'est voulu : un compte qui
> n'accepte que les clés ne peut pas être forcé par devinette de mot de passe. Or
> `ssh-copy-id` a précisément besoin d'un mot de passe pour se connecter et déposer la
> clé. Les deux sont incompatibles. Le script installe donc la clé lui-même, depuis le
> serveur où vous êtes déjà root.

**Il ne touche ni au pare-feu ni à la configuration SSH.** Ces deux réglages, mal
appliqués, vous coupent l'accès à votre propre serveur sans possibilité de revenir en
arrière à distance. Le script vous donne les commandes, à appliquer vous-même, sans
précipitation, et **seulement après avoir vérifié l'étape 3**.

### Étape 3 — Vérifier que ça marche

Depuis votre ordinateur :

```bash
ssh -i ~/.ssh/defi-movember-deploy deploy@31.97.36.104 "docker ps"
```

Vous devez obtenir la liste des conteneurs, sans erreur et **sans qu'on vous demande de
mot de passe**.

**Si un mot de passe est demandé**, la clé publique n'a pas été enregistrée : relancez le
script de l'étape 2 et collez-la à l'invite.

Ne passez à l'étape suivante — et surtout pas au durcissement SSH — tant que cette
commande ne fonctionne pas.

### Étape 4 — Déposer les secrets dans GitHub

Affichez la clé privée :

```bash
cat ~/.ssh/defi-movember-deploy
```

Puis, dans le dépôt GitHub : **Settings → Secrets and variables → Actions →
New repository secret**. Créez ces trois secrets :

| Nom du secret | Valeur |
| --- | --- |
| `VPS_SSH_KEY` | tout le contenu affiché, de `-----BEGIN` à `-----END` inclus |
| `VPS_HOST` | l'adresse IP de votre serveur |
| `VPS_USER` | `deploy` |

Une fois enregistrés, GitHub ne les réaffichera plus jamais, même à vous. C'est voulu.

---

## Ce que vous me communiquez, à moi

Uniquement ceci — rien de secret :

- [ ] La **version du système** du VPS : `cat /etc/os-release | head -2`
- [ ] Le **nom de domaine** choisi, quand il sera réservé
- [ ] La confirmation que **l'étape 3 fonctionne**
- [ ] La confirmation que **les 3 secrets GitHub sont créés**

Avec ça, j'écris la chaîne de déploiement (story 1.3) et le site sera en ligne.

---

## Un point que je dois vous dire franchement

L'utilisateur `deploy` est membre du groupe `docker`. Or **avoir accès à Docker équivaut
en pratique à être administrateur de la machine** : un conteneur peut monter n'importe
quel dossier du serveur. C'est le fonctionnement normal de Docker, pas un défaut de notre
configuration, et c'est le compromis retenu par la quasi-totalité des déploiements de ce
type.

Concrètement, cela veut dire que **quiconque accéderait aux secrets de votre dépôt GitHub
pourrait prendre le contrôle du VPS.** Trois conséquences pratiques :

1. **Activez l'authentification à deux facteurs sur votre compte GitHub**, si ce n'est pas
   déjà fait. C'est la protection la plus importante de toute la chaîne.
2. **Cette clé ne sert qu'à ça.** Ne la réutilisez pour aucun autre serveur ni service.
3. **Elle est révocable en une minute** : supprimez la ligne correspondante dans
   `/home/deploy/.ssh/authorized_keys` sur le serveur, et l'accès est coupé net.

Un durcissement possible — restreindre cette clé à une seule commande précise — est
identifié pour la revue de sécurité (story 11.8). Il n'est pas nécessaire pour démarrer.

---

## Si quelque chose ne marche pas

| Symptôme | Cause probable |
| --- | --- |
| `Permission denied (publickey)` | La clé publique n'est pas arrivée sur le serveur — refaites l'étape 2 |
| On me demande un mot de passe | La clé publique n'est pas enregistrée sur le serveur : relancez le script de l'étape 2 et collez-la à l'invite |
| `ssh-copy-id` demande un mot de passe | Normal et attendu : le compte `deploy` n'en a pas. Ne l'utilisez pas — c'est le script de l'étape 2 qui installe la clé |
| `docker ps` → `permission denied` | Déconnectez-vous et reconnectez-vous : l'appartenance au groupe `docker` ne prend effet qu'à la session suivante |
| Je n'arrive plus à me connecter du tout | Utilisez la **console web Hostinger**, qui ne passe pas par SSH |
