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

**Revenir dessus :**

```bash
cd /opt/defi-movember/deploy
APP_IMAGE=defi-movember:production-XXXXXXX docker compose up -d --force-recreate app
```

*(remplacez `XXXXXXX` par l'étiquette repérée)*

**Vérifier :**

```bash
sleep 30 && curl -s https://defi-movember.fr/api/health | head -c 200
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
Pour l'installer :

```bash
crontab -e
```

Ajoutez cette ligne à la fin :

```
*/10 * * * * bash /opt/defi-movember/deploy/scripts/check-resources.sh >> /var/log/defi-movember-resources.log 2>&1
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

## Ce qui n'est PAS dans ce document

**La restauration d'une sauvegarde de la base.** Elle relève de la story 11.5, qui
l'outille et l'éprouve. En attendant, une restauration passe par le tableau de bord
Supabase, et la formule payante est ce qui donne accès aux sauvegardes automatiques
quotidiennes.

**Les procédures de l'epic 10** (activité douteuse, litige de paiement) : elles arrivent
avec ces lots.

---

## État de vérification

| Procédure | Vérifiée ? |
| --- | --- |
| §1 État du site | oui, contre le serveur de production réel |
| §2 Lire les journaux | à faire par le PO |
| §3 Redémarrer | à faire par le PO |
| §4 Boucle de redémarrage | non — demande de provoquer une panne |
| §5 Revenir en arrière | testé automatiquement par le script de déploiement, pas à la main |
| §6 Base injoignable | oui, le mode dégradé du contrôle de santé est testé |
| §7 Variable manquante | oui, les commandes sont vérifiées |
| §9 Disque plein | commandes vérifiées, situation non provoquée |
| §11 Script d'alertes | oui, exécuté avec seuils abaissés et webhook réel |

> **Une procédure écrite mais jamais exécutée est une procédure fausse.** Les lignes
> marquées « à faire par le PO » doivent être passées au moins une fois, calmement, avant
> le 1ᵉʳ novembre — pas le soir où elles servent.
