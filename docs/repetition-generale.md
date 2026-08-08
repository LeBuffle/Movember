# Répétition générale — un mois en une journée

> **La story la plus importante de l'epic 11** (story 11.9). C'est le seul moyen de
> découvrir en octobre ce qu'on découvrirait sinon le 2 novembre, quand plusieurs centaines
> de personnes attendent leur défi du jour.

**Quand :** une semaine avant l'ouverture des inscriptions, donc **autour du 8 octobre**.
Une semaine, c'est le temps de corriger ce que la répétition révèle. La veille, ce ne
serait qu'une occasion de paniquer.

**Où :** sur la préproduction (`staging.defi-movember.fr`), avec les clés de test Stripe.
Jamais en production.

**Combien de temps :** compter une demi-journée. Les tâches planifiées se déclenchent à la
main, donc rien n'oblige à attendre le lendemain matin.

---

## Ce qu'on cherche

Pas « est-ce que ça marche » — les tests automatisés répondent déjà à cette question, 1400
fois. Ce qu'on cherche, c'est **ce que les tests ne peuvent pas voir** :

- un enchaînement d'écrans qui a du sens pour le développeur et aucun pour un participant ;
- une tâche planifiée qui tourne parfaitement et au mauvais moment ;
- un e-mail qui n'arrive pas parce qu'un quota est atteint ;
- un défi validé qui ne prévient personne ;
- une notification qui arrive à trois heures du matin.

Chacun de ces défauts est passé par des tests verts sur d'autres projets.

---

## Avant de commencer

```bash
# Sur le serveur, l'état de départ
sudo bash /opt/defi-movember/deploy/scripts/check-hardening.sh
curl -s https://staging.defi-movember.fr/api/health
```

Préparer :

- [ ] **Deux vrais comptes e-mail** différents, dont un sur téléphone. Un seul compte ne
      révèle jamais un défaut d'isolation entre participants.
- [ ] **Un compte Strava de test** avec la possibilité d'y injecter des sorties.
- [ ] **Un téléphone** avec l'application installée sur l'écran d'accueil (obligatoire pour
      les notifications sur iPhone).
- [ ] Le catalogue de défis et les cartes **peuplés** — au moins 40 défis et 20 cartes
      publiées, sinon la moitié du jeu ne peut pas se produire.

---

## Le déroulé

Cocher au fur et à mesure. **Ce qui ne se coche pas devient une correction, pas une note
mentale.**

### 1. Inscription et paiement

- [ ] Créer le compte A depuis un téléphone, avec un pseudonyme choisi à l'inscription
- [ ] **L'e-mail de confirmation arrive** — et arrive en moins d'une minute
- [ ] Le pseudonyme ne peut plus être changé depuis « Mon compte »
- [ ] Choisir le niveau 3, payer avec `4242 4242 4242 4242`
- [ ] L'inscription passe à « active » **sans avoir à recharger la page trois fois**
- [ ] Les 2 packs bonus du niveau 3 sont attribués, non révélés
- [ ] Le paiement apparaît dans l'écran Collecte du back-office
- [ ] **Rejouer l'événement Stripe depuis leur tableau de bord** : aucun doublon, aucune
      seconde attribution de packs
- [ ] Refaire l'inscription avec le compte B, niveau 1

### 2. Connexion sportive

- [ ] Le consentement est demandé **avant** la connexion Strava, séparément des CGV
- [ ] Refuser une première fois : le message dit quoi faire, pas « erreur »
- [ ] Accepter, relier Strava, l'écran confirme le lien et la dernière synchronisation
- [ ] Retirer le consentement : le lien est coupé **chez Strava aussi** (le vérifier dans
      les réglages Strava, pas seulement chez nous)
- [ ] Relier à nouveau

### 3. Le mois compressé

Répéter le bloc suivant **au moins cinq fois**, en faisant varier les cas :

- [ ] Déclencher la distribution des défis à la main :
      `curl -H "x-cron-secret: $CRON_SECRET" https://staging.defi-movember.fr/api/cron/defis-du-jour`
- [ ] Le défi du jour apparaît sur l'écran de jeu des deux comptes, et **ce n'est pas le
      même** (défis individualisés)
- [ ] Injecter une sortie qui valide le défi
- [ ] Déclencher le rattrapage : `.../api/cron/rattrapage`
- [ ] Le défi passe validé, les points sont attribués, **une carte est offerte**
- [ ] La notification arrive sur le téléphone
- [ ] Ouvrir la carte : elle rejoint l'album

Les cas à faire au moins une fois chacun :

- [ ] une sortie **qui ne valide pas** le défi (trop courte) → le défi reste ouvert et
      l'écran dit pourquoi
- [ ] une sortie **saisie à la main** dans Strava → elle ne valide rien, et l'écran des
      activités l'explique
- [ ] un défi **cumulé** validé par deux sorties
- [ ] une sortie **aberrante** (20 km en 30 minutes à pied) → elle apparaît dans la file
      d'arbitrage, **sans avoir été rejetée**
- [ ] un jour **sans sortie** → le défi passe manqué, et le rattrapage de la story 4.4 le
      propose à nouveau

### 4. Le collectif

- [ ] Le compte A crée une équipe, récupère le code
- [ ] Le compte B rejoint avec le code
- [ ] Les deux apparaissent dans le classement d'équipe
- [ ] Les sept classements affichent quelque chose de cohérent après
      `.../api/cron/classements`
- [ ] Les compteurs collectifs de la page d'accueil bougent
- [ ] Le capitaine passe la main, puis quitte l'équipe

### 5. La boutique

- [ ] Acheter un pack, payer
- [ ] Les cartes arrivent dans « à découvrir »
- [ ] **Le classement collection ne bouge pas** — c'est le point de tout l'epic 10
- [ ] Le revenu du pack apparaît **distinct des inscriptions** dans l'écran Collecte

### 6. Le back-office, sur téléphone

Toute cette section **depuis un téléphone**, sans aide et sans documentation. C'est le
critère de sortie de l'epic 8.

- [ ] Créer un défi
- [ ] Publier une carte avec son visuel
- [ ] Envoyer une annonce
- [ ] Suspendre un participant, puis lever la suspension
- [ ] Trancher un cas dans la file d'arbitrage
- [ ] Rembourser un paiement de test
- [ ] Lire le journal des actions : **chaque geste ci-dessus y figure, avec son motif**

### 7. La conformité

- [ ] Télécharger l'export de ses données depuis « Mon compte → Mes données »
- [ ] **Ouvrir le fichier et le lire** : il contient bien les activités, et **aucun jeton**
- [ ] Effacer le compte B
- [ ] Vérifier chez Strava que l'autorisation a disparu
- [ ] Vérifier dans le back-office que **la ligne comptable subsiste** et ne désigne plus
      personne
- [ ] Recréer un compte avec la même adresse e-mail : il repart de zéro

### 8. L'exploitation

- [ ] Suivre `docs/runbook.md` §3 : redémarrer l'application
- [ ] Suivre §5 : revenir à la version précédente, puis revenir en avant
- [ ] Suivre §13 : **restaurer une sauvegarde** dans une base d'essai — critère de sortie
- [ ] Provoquer une alerte disque (`check-resources.sh` avec un seuil abaissé) et vérifier
      qu'elle arrive sur le téléphone

### 9. La mesure

Pendant que la préproduction tourne avec ses deux comptes :

```bash
docker stats --no-stream
free -h
```

- [ ] Noter la mémoire réellement consommée par le conteneur
- [ ] **Poser une limite informée** dans `deploy/docker-compose.yml` — à peu près le double
      du maximum observé. Une limite posée au hasard tue le conteneur en pleine soirée
      d'inscription ; l'absence de limite laisse une fuite emporter le serveur entier.

---

## À la fin

Trois questions, et il faut y répondre par écrit :

1. **Qu'est-ce qui n'a pas marché ?** Chaque case non cochée est une correction à
   planifier, avec une date.
2. **Qu'est-ce qui a marché mais m'a fait hésiter ?** C'est là que sont les défauts
   d'interface, et ils ne se voient qu'une fois.
3. **Qu'est-ce que je n'ai pas su faire sans regarder le code ?** Tout ce qui tombe dans
   cette liste doit finir dans `docs/runbook.md` — sinon personne ne saura le faire en
   novembre, y compris celui qui l'a écrit.

Puis **remettre la préproduction à zéro** avant l'ouverture réelle : les comptes de test,
les paiements de test et les équipes de test ne doivent pas se retrouver dans les
classements du 1ᵉʳ novembre.

---

## Trace de la répétition

| Date | Sections passées | Défauts trouvés | Corrigés le |
| --- | --- | --- | --- |
| | | | |

> Une répétition dont on ne garde pas la trace est une répétition qu'on refera de zéro
> l'année prochaine.
