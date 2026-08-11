# Runbook — que faire quand ça ne va pas

Ce document s'adresse à **une personne seule, un dimanche soir de novembre**, qui vient
de recevoir une alerte ou un message d'un participant. Il ne suppose aucune connaissance
technique : chaque commande est à copier telle quelle.

> **La règle d'or.** Ne touchez à rien avant d'avoir lu ce que dit le serveur. Trois
> commandes de diagnostic coûtent trente secondes ; un redémarrage au hasard peut effacer
> l'information qui aurait expliqué la panne.

---

## Avant tout : se connecter au serveur

Depuis votre ordinateur, dans le Terminal :

```bash
ssh deploy@VOTRE-ADRESSE-IP
cd /opt/defi-movember/deploy
```

Toutes les commandes de ce document se lancent **depuis ce dossier**. Si une commande
répond `No such file or directory`, c'est presque toujours que vous n'y êtes pas :
retapez la ligne `cd` ci-dessus.

---

## 1. Le premier réflexe : dans quel état est le site ?

```bash
docker compose ps
```

Ce que vous cherchez dans la colonne **STATUS** :

| Ce qui s'affiche | Ce que ça veut dire |
| --- | --- |
| `Up 3 hours (healthy)` | Le conteneur tourne et se porte bien |
| `Up 30 seconds (health: starting)` | Il vient de démarrer, attendez une minute |
| `Up 2 hours (unhealthy)` | Il tourne mais ne répond pas correctement |
| `Restarting` | Il plante en boucle — voir §4 |
| *(rien / absent)* | Il est arrêté — voir §3 |

Puis, depuis n'importe où :

```bash
curl -s https://defi-movember.fr/api/health?deep=1 | head -c 400
```

- `"status":"ok"` → l'application **et** la base répondent.
- `"status":"degraded"` → l'application tourne, mais la base ne répond pas. Voir §6.
- Rien du tout, ou une erreur de connexion → le site est injoignable. Voir §3.

---

## 2. Lire les journaux

C'est là que se trouve la réponse dans neuf cas sur dix.

```bash
docker compose logs --tail 100 app
```

Pour suivre en direct pendant que vous reproduisez le problème :

```bash
docker compose logs -f app
```

*(`Ctrl + C` pour arrêter de suivre.)*

Pour la préproduction, remplacez `app` par `app-staging`.

**Ce qu'il faut chercher :** les lignes contenant `Error`, `error`, `failed` ou `ECONN`.
Les autres sont du bruit normal.

> Les journaux ne conservent que les **30 derniers mégaoctets** par conteneur, soit
> plusieurs jours en fonctionnement normal. Si un incident date de plus d'une semaine, il
> a peut-être disparu. Copiez ce qui vous intéresse avant de redémarrer quoi que ce soit.

---

## 3. Le site ne répond plus

**Étape 1 — vérifier que c'est bien le site, et pas votre connexion.**

Ouvrez `https://defi-movember.fr` depuis votre téléphone en 4G, réseau Wi-Fi coupé. Si
ça marche, le problème est chez vous, pas sur le serveur.

**Étape 2 — vérifier que le serveur lui-même est vivant.**

```bash
ssh deploy@VOTRE-ADRESSE-IP
```

Si la connexion échoue, le serveur entier est en cause : passez au §8.

**Étape 3 — relancer l'application.**

```bash
cd /opt/defi-movember/deploy
docker compose logs --tail 50 app     # d'abord regarder, ensuite agir
docker compose restart app
```

Attendez trente secondes, puis :

```bash
docker compose ps
curl -s https://defi-movember.fr/api/health?deep=1 | head -c 200
```

**Étape 4 — si ça ne suffit pas**, recréer le conteneur :

```bash
docker compose up -d --force-recreate app
```

**Étape 5 — si ça ne suffit toujours pas**, revenir à la version précédente : §5.

---

## 4. Le conteneur redémarre en boucle

`docker compose ps` affiche `Restarting`. L'application plante au démarrage et Docker la
relance indéfiniment.

```bash
docker compose logs --tail 80 app
```

Les causes, par ordre de fréquence :

| Dans les journaux | Cause | Correction |
| --- | --- | --- |
| `Your project's URL and Key are required` | Une variable manque | §7 |
| `EADDRINUSE` | Le port est déjà pris | `docker compose down && docker compose up -d` |
| `Cannot find module` | L'image est corrompue | Revenir en arrière : §5 |
| `no space left on device` | Le disque est plein | §9 |

**Pour arrêter la boucle pendant que vous cherchez :**

```bash
docker compose stop app
```

Le site sera hors ligne le temps de votre diagnostic — c'est assumé : un site qui plante
en boucle est déjà hors ligne, mais en consommant le processeur.

---

## 5. Revenir à la version précédente

À faire quand un déploiement a cassé quelque chose et que la correction n'est pas
évidente. **Remettre en ligne d'abord, comprendre ensuite.**

**Voir les versions disponibles :**

```bash
docker images defi-movember --format '{{.Tag}}\t{{.CreatedSince}}'
```

Les trois dernières sont conservées. Repérez celle d'avant l'incident — son étiquette
finit par le début du numéro de commit.

**Revenir dessus — une commande :**

```bash
bash /opt/defi-movember/deploy/scripts/rollback.sh production
```

Le script liste les versions disponibles, marque celle en service, choisit la précédente,
demande confirmation, bascule, et attend que le site réponde. S'il ne redémarre pas non
plus, il vous le dit et vous propose de remonter encore d'un cran :

```bash
bash /opt/defi-movember/deploy/scripts/rollback.sh production production-XXXXXXX
```

*(remplacez `XXXXXXX` par l'étiquette repérée dans la liste)*

**Vérifier :**

```bash
curl -s https://defi-movember.fr/api/health | head -c 200
```

La version affichée doit être celle d'avant.

> **Attention.** Cette bascule est valable jusqu'au prochain déploiement, qui remettra la
> version cassée. Prévenez-moi, ou bloquez les déploiements le temps de corriger.

---

## 6. La base de données ne répond pas

Symptôme : le site s'affiche, mais aucune donnée ne charge. `/api/health?deep=1` répond
`"status":"degraded"`.

**Étape 1 — est-ce Supabase ou nous ?**

Ouvrez [status.supabase.com](https://status.supabase.com). Si un incident est en cours,
il n'y a rien à faire d'autre qu'attendre et prévenir les participants. Le site continue
d'afficher ses pages publiques.

**Étape 2 — le projet Supabase est-il en pause ?**

Un projet **gratuit** est mis en pause automatiquement après une semaine sans activité.
Tableau de bord Supabase → le projet affiche « Paused » → bouton **Restore**.

> C'est la raison principale de passer en formule payante avant octobre : une mise en
> pause au milieu du défi arrêterait le jeu jusqu'à ce que quelqu'un s'en aperçoive.

**Étape 3 — les clés sont-elles toujours bonnes ?**

```bash
grep -c '^NEXT_PUBLIC_SUPABASE_URL=https' /opt/defi-movember/deploy/.env.production
```

Doit répondre `1`. Sinon, voir §7.

---

## 7. Une variable de configuration manque

```bash
cd /opt/defi-movember/deploy
ls -la .env .env.production .env.staging
```

Les trois fichiers doivent exister et être en `-rw-------`. Pour comparer avec ce qui est
attendu, sans jamais afficher les valeurs :

```bash
# Noms des variables attendues
grep -o '^[A-Z_]*=' ../.env.example | tr -d '='
# Noms des variables réellement renseignées
grep -o '^[A-Z_]*=.\+' .env.production | cut -d= -f1
```

La différence entre les deux listes est ce qui manque. Complétez avec `nano
.env.production`, puis :

```bash
docker compose up -d --force-recreate app
```

> Un simple `restart` **ne relit pas** les fichiers d'environnement. Il faut recréer le
> conteneur.

---

## 8. Le serveur entier ne répond plus

La connexion SSH échoue, le site est injoignable, rien ne répond.

**Étape 1 — le tableau de bord Hostinger.** Connectez-vous, regardez si le VPS est
marqué en fonctionnement. S'il est arrêté, redémarrez-le depuis l'interface.

**Étape 2 — redémarrage forcé.** Toujours depuis Hostinger, bouton **Restart**. Comptez
deux à trois minutes, puis réessayez la connexion SSH.

**Étape 3 — après le redémarrage**, les conteneurs remontent seuls (`restart: always`).
Vérifiez :

```bash
ssh deploy@VOTRE-ADRESSE-IP
cd /opt/defi-movember/deploy && docker compose ps
```

**Étape 4 — si le serveur ne revient pas**, restaurez la sauvegarde système
(*snapshot*) depuis Hostinger. Vous perdrez ce qui a changé sur le serveur depuis, mais
**pas les données des participants** : elles sont chez Supabase, pas ici.

---

## 9. Le disque est plein

Alerte reçue, ou `no space left on device` dans les journaux.

```bash
df -h /
```

**Ce qui remplit le disque, dans l'ordre :**

```bash
# Les images Docker des anciens déploiements
docker system df

# Faire le ménage : supprime ce qui n'est utilisé par aucun conteneur
docker system prune -a --volumes -f
```

> `docker system prune -a` supprime **toutes** les images inutilisées, y compris celles
> des autres projets du serveur (ACRO HUB, n8n). Elles seront retéléchargées au prochain
> démarrage de ces services — c'est sans danger, mais leur redémarrage sera plus lent.
> Pour ne toucher qu'à notre projet :
>
> ```bash
> docker image prune -a --filter 'label=com.docker.compose.project=defi-movember' -f
> ```

Puis vérifiez que le site répond toujours : `curl -s https://defi-movember.fr/api/health`

---

## 10. Le serveur rame

```bash
free -h            # mémoire
uptime             # charge moyenne
docker stats --no-stream   # consommation par conteneur
```

Dans `docker stats`, la colonne **MEM USAGE** dit qui consomme. Si c'est un conteneur
qui ne nous appartient pas, la question se règle avec le projet concerné.

Si `free -h` montre une mémoire pleine **et** un espace d'échange (*swap*) à zéro, le
serveur n'a aucune marge : au moindre pic, le système tue un processus au hasard. Ajouter
2 Go d'échange est une opération sans risque, à faire en dehors du mois de novembre.

---

## 11. Les alertes

**Surveillance externe** — interroge `https://defi-movember.fr/api/health?deep=1` toutes
les cinq minutes et prévient par e-mail et SMS. À configurer sur un service gratuit
(UptimeRobot ou équivalent) :

| Réglage | Valeur |
| --- | --- |
| Type | HTTP(s) |
| Adresse | `https://defi-movember.fr/api/health?deep=1` |
| Intervalle | 5 minutes |
| Alerte si | code différent de 200 |

**Alertes disque et mémoire** — un script tourne toutes les dix minutes sur le serveur.

> **N'éditez jamais le crontab sur le serveur.** Il est réinstallé depuis
> `deploy/crontab` à chaque déploiement en production : une ligne ajoutée à la main
> disparaîtrait au déploiement suivant, sans que personne s'en aperçoive. Les tâches
> planifiées se modifient dans le dépôt, pas sur la machine.

Pour voir ce qui est réellement installé :

```bash
crontab -l
```

Si la liste est vide — parce qu'aucun déploiement en production n'a encore eu lieu :

```bash
crontab /opt/defi-movember/deploy/crontab
```

Pour l'essayer tout de suite, sans rien envoyer :

```bash
bash /opt/defi-movember/deploy/scripts/check-resources.sh --dry-run
```

Il envoie ses alertes à l'adresse indiquée par `ALERT_WEBHOOK_URL` dans
`deploy/.env`. **Une seule alerte par problème et par jour** : sans cela, un disque à 81 %
enverrait 144 messages identiques avant que quiconque se réveille.

**Erreurs applicatives** — remontées dans Sentry, si `NEXT_PUBLIC_SENTRY_DSN` est
renseigné. Aucune donnée personnelle n'y est envoyée : adresses e-mail, cookies et
contenus de formulaire sont retirés avant l'envoi.

---

## 12. Qui prévenir, et quoi dire

Pendant le mois de novembre, une panne se voit. Mieux vaut l'annoncer que la laisser
découvrir.

**Si la panne dure plus de trente minutes**, publiez un message. Ce qui rassure :

> *Le site est momentanément indisponible, nous travaillons à le rétablir. **Vos activités
> sportives ne sont pas perdues** : elles sont enregistrées sur Strava et seront prises en
> compte dès le retour du site. Aucun défi ne sera perdu.*

C'est vrai, et c'est la première question que les participants se poseront.

---

## 12 quater. Le déploiement échoue sur « pas de réponse sur le port 22 »

**Symptôme :** le déploiement s'arrête à la toute première étape, avant d'avoir touché au
code, avec ces lignes :

```
tentative 1/12 — pas de réponse sur le port 22, nouvel essai dans 10s
...
✗ Le serveur n'a pas répondu sur le port 22 en cinq minutes.
```

**Le code n'est pas en cause, et c'est la première chose à savoir.** Cette étape se joue
avant que le dépôt ne soit envoyé au serveur : elle demande simplement au VPS de se
présenter. S'il ne répond pas, rien de ce qui a été écrit n'est concerné. Le contrôle
« Vérifications » du même commit, lui, est vert — c'est ce qui le prouve.

### Le seul test qui départage, en dix secondes

**Ouvrir `https://defi-movember.fr` dans un navigateur.**

| Le site répond | Le site ne répond pas |
| --- | --- |
| Le serveur tourne, **seul SSH est tombé** | **C'est le serveur entier** |
| Voir « SSH seul » ci-dessous | Voir « Le serveur entier » ci-dessous |

### Le serveur entier

Panneau Hostinger → le VPS. Trois cas, dans l'ordre de fréquence :

1. **Redémarrage ou maintenance en cours.** Attendre trois minutes, puis relancer le
   déploiement depuis l'onglet Actions de GitHub (bouton « Re-run failed jobs »).
   C'est ce qui s'est passé le 11 août : la relance est passée sans qu'une ligne de code
   ne change.
2. **VPS éteint.** Le rallumer depuis le panneau, attendre que le site réponde, relancer.
3. **Disque plein.** Voir la section 9 — un disque plein empêche aussi bien SSH que le
   reste de fonctionner.

### SSH seul

Le serveur sert le site mais refuse le port 22. Deux causes, et la première est de loin la
plus courante :

1. **`fail2ban` a banni l'adresse du runner GitHub.** Les runners changent d'adresse à
   chaque exécution, donc ce n'est pas un bannissement de « notre » machine mais d'une
   plage. Se connecter depuis le panneau Hostinger (console web, qui ne passe pas par le
   port 22) et regarder :

   ```bash
   sudo fail2ban-client status sshd
   ```

   Débannir une adresse : `sudo fail2ban-client set sshd unbanip <adresse>`.

2. **Le service SSH s'est arrêté.** Toujours depuis la console web :

   ```bash
   sudo systemctl status ssh
   sudo systemctl restart ssh
   ```

### Ce qui a déjà été fait pour l'éviter

La fenêtre d'attente est de **douze tentatives sur cinq minutes**, ce qui couvre un
redémarrage ordinaire (une à trois minutes). Elle était de cent secondes jusqu'au 11 août,
et c'est précisément cette limite qui a fait échouer le déploiement de l'epic 12.

**Si cette section sert plus de deux fois avant le 1ᵉʳ novembre**, le problème n'est pas la
fenêtre d'attente : c'est le VPS. Ouvrir un ticket chez Hostinger avec les dates et les
heures des échecs.

---

## 12 ter. Un site répond 404 après un déploiement — l'autre va bien

**Symptôme :** le déploiement réussit, le conteneur est sain, et pourtant le site répond
`404` sur toutes ses adresses. Parfois c'est l'environnement qu'on **n'a pas** déployé.

**404 et pas 502 : la distinction est le diagnostic.** Un 502 veut dire « Traefik a trouvé
la route et le conteneur ne répond pas ». Un 404 veut dire « Traefik n'a trouvé aucune
route pour ce nom de domaine » — l'application n'est même pas sollicitée.

### La cause rencontrée le 11 août

Production et préproduction déclaraient le **même middleware Traefik**
(`movember-security`) depuis deux conteneurs. Tant que les deux définitions étaient
identiques, Traefik s'en accommodait. Un déploiement les fait différer par construction :
un conteneur est recréé avec la nouvelle politique pendant que l'autre tourne encore avec
l'ancienne. Traefik refuse alors de trancher et abandonne les routeurs qui référencent ce
middleware.

**C'est corrigé** : chaque environnement a désormais son propre nom de middleware, et un
test l'exige. Mais le raisonnement reste vrai pour tout nom partagé entre deux conteneurs.

### La signature dans le journal

C'est elle qui identifie le cas en dix secondes :

```
ERR Middleware defined multiple times with different configurations
    middlewareName=movember-security providerName=docker
ERR error="middleware \"movember-security@docker\" does not exist"
    routerName=movember@docker
```

**Traefik nomme le middleware fautif et les routeurs qu'il abandonne.** Il ne journalise
rien quand tout va bien : après correction, le silence est le bon résultat.

### Diagnostic

```bash
# 1. Les routeurs vus par Traefik
docker logs n8n-traefik-1 --since 15m 2>&1 | grep -iE "movember|middleware" | tail -20

# 2. Le conteneur tourne-t-il, et est-il sain ?
docker ps --format '{{.Names}}\t{{.Status}}' | grep movember

# 3. L'application répond-elle DIRECTEMENT, sans passer par Traefik ?
docker exec defi-movember-app-staging-1 wget -qO- http://localhost:3000/api/health
```

Si le point 3 répond et que l'adresse publique fait 404, le problème est chez Traefik, pas
dans l'application.

### Correction immédiate

Recréer **les deux** conteneurs, et **après** s'être assuré que le disque porte bien la
version corrigée — c'est le piège qui a fait perdre une demi-heure le 11 août :

```bash
cd /opt/defi-movember && git log --oneline -1     # la version sur le disque
cd deploy && docker compose up -d --force-recreate
sleep 10
curl -s -o /dev/null -w 'staging %{http_code}\n' https://staging.defi-movember.fr/api/health
curl -s -o /dev/null -w 'prod    %{http_code}\n' https://defi-movember.fr/api/health
docker logs n8n-traefik-1 --since 2m 2>&1 | grep -iE "movember|middleware"
```

Recréer les conteneurs pendant que le disque porte encore l'ancienne version les remet
dans l'état fautif. `deploy.sh` ne recrée que le service qu'il déploie, ce qui est
maintenant sans danger — les noms de middleware sont distincts — mais reste vrai pour tout
autre nom qu'on partagerait un jour.

---

## 12 bis. Un visuel de carte ne s'affiche pas

**Symptôme :** le visuel est correct au moment de l'import, la carte s'enregistre sans
erreur, et ensuite l'image apparaît cassée — dans le back-office comme dans l'album.

**Ce n'est presque jamais le téléversement.** Le fichier est bien dans le seau. C'est le
navigateur qui refuse de l'afficher, parce que la politique de sécurité du site
(`Content-Security-Policy`) n'autorise que notre propre domaine à fournir des images.

L'aperçu au moment de l'import fonctionne quand même : il montre le fichier local, pas
encore l'adresse de stockage. C'est ce qui rend le défaut trompeur.

### Confirmer en trente secondes

1. Ouvrir la console du navigateur (F12 → Console). Un message y attend :
   `Refused to load the image … violates the following Content Security Policy directive:
   img-src …`
2. Ou : copier l'adresse de l'image et l'ouvrir dans un onglet. **Si elle s'affiche**, le
   téléversement est bon et c'est bien la politique de sécurité.
   Si elle renvoie une erreur, alors le problème est ailleurs — seau, droits, ou nom
   d'objet.

### Corriger

Dans `deploy/.env` sur le VPS :

```
CSP_IMG_SRC=https://xxxx.supabase.co
```

La même URL que dans `CSP_CONNECT_SRC`. Puis recréer les conteneurs — la politique est
posée par Traefik depuis ce fichier, donc un simple redémarrage ne suffit pas :

```bash
cd /opt/defi-movember/deploy && docker compose up -d --force-recreate
```

Vérifier ensuite, sans ouvrir de navigateur :

```bash
curl -sI https://staging.defi-movember.fr/ | grep -i content-security-policy
```

L'URL Supabase doit apparaître dans `img-src`.

---

## 13. Restaurer une sauvegarde de la base

> **La procédure la plus grave du document.** Une restauration écrase des données. À ne
> lancer que sur une base dont on est certain, et jamais dans la précipitation.

### Ce qui existe comme sauvegardes

Deux choses, complémentaires :

| Source | Ce qu'elle couvre | Ce qu'elle ne couvre pas |
| --- | --- | --- |
| Supabase (tableau de bord) | une panne de Supabase, une restauration à un instant donné | une erreur de notre part, effacée aussitôt dans leur copie |
| `deploy/scripts/backup-database.sh` | **nos** erreurs : une migration qui supprime la mauvaise colonne, une purge à la mauvaise date | une perte du VPS lui-même |

La seconde est celle qui permet de **répéter** une restauration — la première ne se
restaure que dans le projet Supabase lui-même.

### Voir ce qu'on a

```bash
sudo bash /opt/defi-movember/deploy/scripts/backup-database.sh --check
```

Sept copies quotidiennes, la plus récente datée du matin même. Si la liste est vide ou
ancienne, **s'arrêter là** et lire §11 : la tâche planifiée ne tourne pas.

### La répétition (à faire une fois, en octobre)

**Ne jamais répéter sur la base de production.** Créer un projet Supabase gratuit
temporaire, ou une base Postgres locale, et restaurer dedans :

```bash
# 1. Choisir une sauvegarde
ls -lh /var/backups/defi-movember/

# 2. La restaurer dans la base D'ESSAI (jamais celle de production)
gunzip -c /var/backups/defi-movember/defi-movember-2026-10-15.sql.gz \
  | psql "$URL_DE_LA_BASE_D_ESSAI"

# 3. Vérifier qu'on a bien récupéré quelque chose
psql "$URL_DE_LA_BASE_D_ESSAI" -c "select count(*) from public.profiles;"
psql "$URL_DE_LA_BASE_D_ESSAI" -c "select count(*) from public.payments;"
```

Le dump est fait avec `--clean --if-exists` : il supprime avant de recréer, donc il
s'applique sur une base déjà peuplée sans erreur de doublon. C'est aussi pourquoi il est
dangereux : appliqué à la bonne base, il fait exactement ce qu'on lui demande.

### La vraie restauration, le jour où

1. **Arrêter l'application** pour que rien n'écrive pendant l'opération :
   `docker compose -f /opt/defi-movember/deploy/docker-compose.yml stop app`
2. **Sauvegarder l'état actuel**, même s'il est cassé :
   `sudo bash /opt/defi-movember/deploy/scripts/backup-database.sh`
   (une restauration qui se révèle être la mauvaise décision doit pouvoir se défaire)
3. Restaurer, comme ci-dessus, vers l'URL de production
4. **Relancer** : `docker compose -f .../docker-compose.yml start app`
5. Vérifier : `curl -s https://defi-movember.fr/api/health`

### Après une restauration

- Les classements sont recalculés au quart d'heure suivant. Pour ne pas attendre,
  déclencher la tâche `classements` à la main (§11).
- **Vérifier la comptabilité contre Stripe** : une restauration à un instant antérieur
  peut avoir perdu des paiements. La tâche `rapprochement` les rattrape toute seule à
  l'heure suivante, et l'écran Collecte doit reboucler.

---

## Ce qui n'est PAS dans ce document

**La création d'un projet Supabase de secours.** Elle relève d'une décision du PO, pas
d'une procédure d'urgence.

---

## État de vérification

| Procédure | Vérifiée ? |
| --- | --- |
| §1 État du site | oui, contre le serveur de production réel |
| §2 Lire les journaux | à faire par le PO |
| §3 Redémarrer | à faire par le PO |
| §4 Boucle de redémarrage | non — demande de provoquer une panne |
| §5 Revenir en arrière | oui — `rollback.sh` vérifié sur ses trois chemins : choix automatique, étiquette explicite, refus quand il n'y a rien à rétablir |
| §6 Base injoignable | oui, le mode dégradé du contrôle de santé est testé |
| §7 Variable manquante | oui, les commandes sont vérifiées |
| §9 Disque plein | commandes vérifiées, situation non provoquée |
| §11 Script d'alertes | oui, exécuté avec seuils abaissés et webhook réel |
| §11 Tâches planifiées | fichier versionné et installé par le déploiement ; **l'appel réel reste à vérifier par le PO** |
| §13 Restaurer une sauvegarde | script vérifié sur ses refus (dump vide, configuration absente) ; **la restauration elle-même reste à répéter par le PO** — c'est le critère de sortie de l'epic 11 |
| Durcissement du serveur | `check-hardening.sh` écrit et vérifié syntaxiquement ; **à lancer sur le serveur par le PO** |

> **Une procédure écrite mais jamais exécutée est une procédure fausse.** Les lignes
> marquées « à faire par le PO » doivent être passées au moins une fois, calmement, avant
> le 1ᵉʳ novembre — pas le soir où elles servent.
