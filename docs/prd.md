# DEFI Movember — Product Requirements Document (PRD)

| | |
| --- | --- |
| **Version** | v1.1 — Phase 2 BMAD (Product Manager) |
| **Date** | 3 août 2026 |
| **Auteur** | Agent PM (BMAD), sur la base du Project Brief v1.1 |
| **Statut** | En attente de validation PO |
| **Document amont** | [`docs/brief.md`](brief.md) |

---

## 1. Objectifs et contexte

### 1.1 Objectifs

- Reverser **10 000 €** à la fondation Movember, contre 5 000 € à l'édition 4.
- Réunir **600 participants** payants au 1ᵉʳ novembre 2026 (plancher 400, cible haute 800).
- Franchir **50 000 km** et **6 000 heures** de sport cumulées sur le mois.
- Permettre à l'équipe organisatrice d'animer 30 jours de jeu en **moins de 30 minutes
  par jour**, sans aucune intervention de développement.
- Ouvrir la participation **au-delà du réseau de la Table Ronde Française** : au moins
  3 entités externes (association, entreprise, club) inscrivant une équipe.
- Livrer une application **stable et opérationnelle** à date fixe, pour un coût
  d'infrastructure inférieur à **30 € par mois**.

### 1.2 Contexte

L'édition 4 du défi Movember de la Table Ronde Française a réuni 400 participants et
reversé 5 000 € — soit 12,50 € par personne — pour 30 000 km et 3 500 heures de sport.
Le concept est validé ; ce qui bloque la croissance, c'est l'outil. Les quatre premières
éditions reposaient sur un suivi manuel des performances, des relances individuelles et
des classements tenus à la main. Ce mode de fonctionnement plafonne mécaniquement le
nombre de participants qu'une équipe bénévole peut accueillir.

Cette 5ᵉ édition change de dimension sur deux axes simultanés. D'une part une **grille à
trois niveaux d'inscription**, qui double la collecte à effectif constant. D'autre part
une **plateforme qui absorbe la charge d'animation**, ce qui rend possible l'ouverture à
d'autres associations, à des entreprises et au grand public.

Deux données de l'édition 4 gouvernent la conception du jeu. Le participant médian fait
**75 km et 8h45 de sport sur le mois**, soit environ **17 minutes par jour** : les défis
doivent donc être courts, et le jeu doit accepter qu'on saute des journées. Et **la
collecte se joue sur le panier moyen bien plus que sur le volume** : passer de 12,50 € à
18 € par participant rapporte davantage que recruter 100 personnes de plus.

### 1.3 Journal des versions

| Date | Version | Description | Auteur |
| --- | --- | --- | --- |
| 2026-08-03 | v1 | Rédaction initiale à partir du Brief v1.1 | Agent PM |
| 2026-08-03 | v1.1 | Règles du jeu précisées par le PO : défis individualisés tirés d'un catalogue, défis cumulables et sans blocage, sept classements, une carte par défi réussi, raretés commune/rare/épique/légendaire, packs de 5 cartes, thème moustache des cartes. Hébergement sur VPS Hostinger. | Agent PM |

---

## 2. Décisions produit structurantes

Sept décisions conditionnent tout le reste du document. Elles sont énoncées ici pour
éviter d'avoir à les redémontrer à chaque section.

### D1 — Le montant reversé progresse avec le niveau

| Niveau | Nom | Prix | Reversé | Contrepartie |
| --- | --- | --- | --- | --- |
| 1 | Sportif engagé | 12 € | 12 € | Accès complet au jeu |
| 2 | Sportif chevronné | 30 € | 18 € | Niveau 1 + médaille premium |
| 3 | Sportif légendaire | 50 € | 35 € | Niveau 2 + 2 packs dont une légendaire garantie |

Les montants reversés reposent sur une hypothèse de médaille à 10 € tout compris. **Ils
devront être arrêtés définitivement une fois le prix de la médaille ferme** — c'est le
seul chiffre du modèle qui manque, et le seul capable de le rendre déficitaire.

### D2 — Le jeu est intégralement jouable sans dépenser un euro de plus

Les 30 défis du mois sont réalisables avec la seule inscription de niveau 1. Les packs
sont un bonus pour les joueurs les plus enthousiastes.

**Conséquence produit non négociable :** aucun avantage compétitif ne peut être acheté.

- Le **classement général** se fonde sur les points des défis réussis, **jamais sur les
  cartes possédées**.
- Le **classement collection**, souhaité par le PO, ne compte que les **cartes gagnées par
  le jeu** — les cartes issues d'un pack acheté ou du bonus de niveau 3 en sont exclues.
  Acheter un pack aide à compléter son album, mais ne fait pas gagner une place au
  classement.

L'album affiche donc deux compteurs distincts : « cartes gagnées » (celle qui compte) et
« collection complète » (achats inclus).

### D3 — Les défis sont courts, cumulables, et le jeu pardonne les jours manqués

Le participant médian fait 17 minutes de sport par jour. Un défi quotidien exigeant
45 minutes d'effort exclurait la majorité des participants. Le jeu doit donc :

- proposer des défis atteignables par le participant médian ;
- ne jamais pénaliser durablement une journée manquée ;
- proposer des défis « régularité » qui récompensent la constance sans exiger 30/30.

**Trois règles posées par le PO en découlent :**

- **Aucun défi n'en bloque un autre.** Ne pas avoir réussi le défi du jour n'empêche pas
  de recevoir et de réussir celui du lendemain.
- **Un défi manqué reste ouvert** et peut être validé plus tard.
- **Une même sortie peut valider plusieurs défis à la fois.** Une sortie vélo de 30 km
  valide simultanément « 20 km à vélo » et « 1 heure d'activité ». C'est ce qui rend le
  rattrapage possible pour quelqu'un qui a pris du retard.

### D4 — Le back-office est un produit à part entière, pas une page d'administration

C'est la promesse centrale de la refonte. S'il n'est pas réellement autonome, le projet
déplace le travail manuel au lieu de le supprimer. Créer un défi, publier une carte ou
envoyer une notification doit être une saisie, **jamais un déploiement**. Il doit être
utilisable depuis un téléphone par un bénévole sans compétence technique.

### D5 — Aucune saisie manuelle d'activité, jamais

Seules les activités remontées par l'API Strava font foi. En contrepartie, un mécanisme
d'**arbitrage manuel par l'administrateur** est prévu pour les cas exceptionnels (panne
Strava, litige justifié). Cet arbitrage est tracé et reste marginal.

### D6 — Les sommes versées ne sont pas des dons défiscalisables

Frais d'inscription et achats avec contrepartie. Aucun reçu fiscal, aucun CERFA. Cette
mention doit être visible **avant le paiement**, pas seulement dans les CGV.

### D7 — Indépendance visuelle vis-à-vis de la fondation

Charte propre bleu / orange, thème sport et moustache. Aucun logo, visuel ou élément
d'identité de la fondation Movember. Une mention d'indépendance est visible sur les pages
publiques et dans l'application.

### D8 — Chaque participant reçoit son propre défi

L'administrateur n'écrit pas « le défi du 12 novembre ». Il constitue un **catalogue de
défis** — types d'activité variés (course, vélo, natation, renforcement musculaire,
marche…), difficultés et durées variables — dans lequel le système tire chaque jour un
défi pour chaque participant.

**Deux conséquences importantes.**

D'abord, **l'organisation n'a pas à produire un défi chaque matin de novembre.** Le
catalogue se constitue en septembre et octobre ; le mois se déroule ensuite tout seul. Le
back-office sert à ajuster et à animer, pas à alimenter en urgence.

Ensuite, **le classement ne peut plus compter le nombre de défis réussis** : celui qui
tire des défis faciles serait avantagé. Chaque défi porte donc une **valeur en points**
reflétant sa difficulté et sa durée, et le classement général cumule ces points.

L'administrateur conserve la possibilité d'**imposer un défi commun à tous** pour une
journée — c'est le mécanisme des défis collectifs et des animations spéciales.

### D9 — La difficulté d'un défi ne détermine pas la rareté de la carte

Règle explicite du PO : la carte obtenue est **tirée au sort**, indépendamment de la
difficulté du défi. Un défi difficile peut donner une carte commune, un défi facile une
carte épique.

**Conséquence à surveiller :** la seule récompense d'un défi difficile étant les points,
l'écart de points entre facile et difficile doit être assez marqué pour qu'il vaille la
peine d'être tenté. Un rapport de 1 à 3 sert de point de départ, ajustable en cours
d'édition.

### D10 — L'économie des cartes

| Règle | Valeur retenue |
| --- | --- |
| Attribution | **1 carte tirée au sort par défi réussi.** Rattraper trois défis en retard donne donc trois cartes |
| Raretés | **4 niveaux, du plus courant au plus rare** : commune → rare → épique → **légendaire** |
| Volume au lancement | ~50 cartes, collection extensible en cours de mois |
| Thème | Moustaches : formes, couleurs, noms fantaisistes (« mono moustache », « moustache girlie », « moustache fine », « moustache touffue », « moustache cowboy », « moustache d'or », « moustache teinte », « moustache blanche »…) |
| Pack booster | **5 cartes** par pack |
| Bonus niveau 3 | 2 packs, dont **une carte légendaire garantie** |

> La rareté « légendaire » est le sommet de la collection et n'est garantie que par le
> bonus du niveau 3 — ce qui donne sa valeur à la contrepartie du « Sportif légendaire »
> sans pour autant procurer d'avantage au classement (décision D2). Les cartes légendaires
> restent accessibles gratuitement par le tirage des défis, simplement avec une
> probabilité faible.

---

## 3. Exigences fonctionnelles

Priorisation **MoSCoW** : **M** = indispensable au 1ᵉʳ novembre · **S** = important, à
livrer si le calendrier le permet · **C** = souhaitable, hors MVP · **W** = exclu de
cette édition.

### 3.1 Parcours visiteur public

| # | Exigence | Prio |
| --- | --- | --- |
| FR1 | Une page d'accueil publique présente la cause, la règle du jeu, les 3 niveaux et leurs contreparties, et le calendrier de l'édition. | M |
| FR2 | La page d'accueil affiche un compteur public en temps quasi réel : montant collecté, nombre de participants, kilomètres et heures cumulés. | M |
| FR3 | La mention « ceci n'est pas un don défiscalisable, aucun reçu fiscal ne sera émis » est affichée sur la page d'accueil et rappelée avant tout paiement. | M |
| FR4 | Une mention d'indépendance vis-à-vis de la fondation Movember est visible sur toutes les pages publiques. | M |
| FR5 | Le visiteur peut consulter les CGV, la politique de confidentialité et les mentions légales. | M |
| FR6 | Le visiteur peut consulter le classement public des participants et des équipes, sans être inscrit. | S |
| FR7 | Le visiteur peut consulter la galerie des cartes de la collection (sans les posséder). | S |
| FR8 | Le visiteur peut consulter le fil d'actualité public du jeu. | S |
| FR9 | Une page dédiée présente l'offre aux entreprises et associations souhaitant inscrire une équipe. | C |

### 3.2 Inscription et paiement

| # | Exigence | Prio |
| --- | --- | --- |
| FR10 | Le visiteur choisit l'un des 3 niveaux d'inscription, avec un comparatif clair des contreparties. | M |
| FR11 | Le paiement s'effectue en ligne par carte via Stripe, en euros. | M |
| FR12 | Le paiement précède et conditionne l'accès au jeu : aucun contenu de jeu n'est accessible sans inscription payée. | M |
| FR13 | À l'issue du paiement, un compte est créé et l'utilisateur reçoit un e-mail de confirmation détaillant son niveau, le montant payé et le montant reversé. | M |
| FR14 | L'utilisateur accepte explicitement les CGV et la mention d'absence de reçu fiscal avant de payer. | M |
| FR15 | Un paiement échoué ou abandonné ne crée pas de participant actif et peut être repris. | M |
| FR16 | Les participants de niveau 2 et 3 renseignent une adresse postale de livraison pour la médaille, collectée au plus tard à la fin du jeu. | M |
| FR17 | L'administrateur peut rembourser une inscription depuis le back-office, avec traçabilité. | S |
| FR18 | Un participant peut faire évoluer son niveau en cours d'édition en payant la différence. | C |
| FR19 | Une entreprise ou une association peut inscrire et régler plusieurs participants en une seule opération. | C |
| FR20 | Un code de réduction ou d'invitation peut être appliqué à l'inscription. | W |

### 3.3 Compte, authentification et RGPD

| # | Exigence | Prio |
| --- | --- | --- |
| FR21 | L'utilisateur peut se connecter, se déconnecter et réinitialiser son mot de passe. | M |
| FR22 | L'utilisateur renseigne un pseudonyme affiché publiquement, distinct de son identité civile. | M |
| FR23 | L'utilisateur donne un consentement explicite et distinct à la récupération de ses données d'activité sportive, avant la connexion Strava. | M |
| FR24 | L'utilisateur peut exporter l'intégralité de ses données personnelles dans un format lisible. | M |
| FR25 | L'utilisateur peut supprimer son compte et ses données, y compris révoquer la liaison Strava. | M |
| FR26 | L'utilisateur peut consulter et modifier ses préférences de notification par catégorie. | M |
| FR27 | L'utilisateur peut déconnecter son compte Strava sans supprimer son compte de jeu. | S |

### 3.4 Connexion Strava et synchronisation

| # | Exigence | Prio |
| --- | --- | --- |
| FR28 | Le participant connecte son compte Strava en un minimum de clics, par autorisation OAuth. | M |
| FR29 | Les activités du participant sont récupérées automatiquement pendant toute la durée du jeu, sans action de sa part. | M |
| FR30 | Une activité nouvellement enregistrée est prise en compte dans un délai court après son apparition sur Strava. | M |
| FR31 | Le participant voit à tout moment l'état de sa connexion Strava et la date de la dernière synchronisation. | M |
| FR32 | En cas d'interruption de la liaison Strava, le participant est alerté et guidé pour la rétablir. | M |
| FR33 | Après une indisponibilité de Strava, les activités de la période sont rattrapées automatiquement. | M |
| FR34 | Le participant peut déclencher manuellement une resynchronisation depuis son profil. | S |
| FR35 | Seules les données strictement nécessaires à l'évaluation des défis sont conservées ; les tracés GPS détaillés ne sont pas stockés. | M |
| FR36 | Le système peut accueillir d'autres sources d'activité que Strava sans refonte. | S |

### 3.5 Moteur de défis

| # | Exigence | Prio |
| --- | --- | --- |
| FR37 | Chaque participant se voit attribuer un défi par jour, **tiré individuellement** dans le catalogue — les participants n'ont pas tous le même défi. | M |
| FR38 | Le moteur évalue automatiquement les défis à partir des activités synchronisées, sans intervention. | M |
| FR39 | Types de défis couverts : distance, durée, dénivelé, régularité, multi-sports, collectif, surprise. | M |
| FR40 | Les défis couvrent des types d'activité variés : course, vélo, natation, renforcement musculaire, marche, et autres sports remontés par Strava. | M |
| FR41 | Chaque défi porte une **difficulté** et une **durée** (journalier ou sur plusieurs jours), ainsi qu'une **valeur en points** reflétant l'effort demandé. | M |
| FR42 | Le participant voit ses défis en cours, leur progression et leur statut (ouvert, réussi, expiré). | M |
| FR43 | Le participant consulte l'historique de ses défis et son résultat sur chacun. | M |
| FR44 | **Un défi n'en bloque jamais un autre** : ne pas avoir réussi celui du jour n'empêche pas de recevoir et de réussir le suivant. | M |
| FR45 | **Un défi non réussi reste ouvert** et peut être validé ultérieurement. | M |
| FR46 | **Une même activité peut valider plusieurs défis ouverts simultanément.** | M |
| FR47 | Un défi réussi déclenche l'attribution d'**une carte tirée au sort**, indépendamment de la difficulté du défi. | M |
| FR48 | L'administrateur alimente le catalogue de défis depuis le back-office, sans redéploiement de l'application. | M |
| FR49 | L'administrateur peut **imposer un défi commun à tous les participants** pour une journée donnée. | M |
| FR50 | L'attribution évite d'attribuer deux fois le même défi à un participant, et tient compte des sports qu'il pratique. | M |
| FR51 | Un défi collectif agrège les contributions de tous les participants vers un objectif commun affiché. | M |
| FR52 | Le participant est notifié de son défi du jour, puis du résultat de son évaluation. Plusieurs défis validés simultanément donnent lieu à une **notification groupée**. | M |
| FR53 | L'administrateur peut valider ou invalider manuellement un défi pour un participant donné, avec motif tracé. | M |
| FR54 | Le système alerte les administrateurs si le catalogue est épuisé ou passe sous un seuil critique. | M |
| FR55 | Un défi peut être restreint à une équipe ou à un groupe de participants. | C |
| FR56 | Un mécanisme de joker permet de valider un défi expiré sous conditions. | C |

### 3.6 Cartes et collection

| # | Exigence | Prio |
| --- | --- | --- |
| FR57 | La collection compte environ 50 cartes au lancement, réparties en **4 niveaux de rareté** : commune, rare, épique, légendaire. | M |
| FR58 | Les cartes sont sur le thème de la moustache — formes, couleurs, noms fantaisistes — et regroupées en séries. | M |
| FR59 | Le participant consulte son album : cartes obtenues, manquantes, taux de complétion, avec **deux compteurs distincts** — « cartes gagnées » et « collection complète ». | M |
| FR60 | L'attribution d'une carte suit des règles de tirage paramétrables tenant compte de la rareté. | M |
| FR61 | L'obtention d'une carte est mise en scène (animation de révélation) et notifiée. | M |
| FR62 | De nouvelles cartes peuvent être ajoutées à la collection en cours de mois depuis le back-office. | M |
| FR63 | Le participant peut consulter le détail d'une carte : visuel, nom, rareté, série, date d'obtention. | M |
| FR64 | Les participants de niveau 3 reçoivent automatiquement leurs **2 packs de 5 cartes**, dont **une carte légendaire garantie**. | M |
| FR65 | Le participant peut acheter des **packs de 5 cartes** en cours de jeu, par paiement Stripe. | S |
| FR66 | Un pack acheté suit des règles de composition paramétrables et garantit sa contrepartie annoncée. | S |
| FR67 | Le participant peut partager le visuel d'une carte obtenue sur les réseaux sociaux. | C |
| FR68 | Les participants peuvent échanger des cartes entre eux. | W |

### 3.7 Équipes, classements et progression

| # | Exigence | Prio |
| --- | --- | --- |
| FR69 | Un participant peut créer une équipe ou rejoindre une équipe existante via un lien ou un code. | M |
| FR70 | Le **classement général** est calculé sur les **points** des défis réussis, jamais sur les cartes possédées. | M |
| FR71 | Six **classements secondaires** sont calculés et affichés : défis réalisés, cartes gagnées, kilomètres en course, kilomètres en vélo, nombre d'activités, temps d'activité. | M |
| FR72 | Le **classement des cartes ne compte que les cartes gagnées par le jeu** — les cartes issues d'un pack acheté ou du bonus de niveau 3 en sont exclues. | M |
| FR73 | Un classement par équipe est calculé et affiché, **normalisé par le nombre de membres** pour ne pas désavantager les petites équipes. | M |
| FR74 | Le participant consulte son tableau de bord personnel : points, défis réussis, kilomètres, heures, cartes, et sa position dans chaque classement. | M |
| FR75 | Les compteurs collectifs (km, heures, montant) sont visibles dans l'application et sur la page publique. | M |
| FR76 | Un participant peut quitter une équipe ; le capitaine peut en exclure un membre. | S |
| FR77 | Une équipe dispose d'une page dédiée avec ses membres, sa progression et son classement. | S |
| FR78 | L'administrateur peut créer une équipe pour le compte d'une entreprise ou d'une association. | S |

### 3.8 Notifications

| # | Exigence | Prio |
| --- | --- | --- |
| FR79 | Le participant reçoit une notification push à l'attribution de son défi du jour. | M |
| FR80 | Le participant reçoit une notification à la validation d'un défi et à l'obtention d'une carte, **groupée si plusieurs défis sont validés en même temps**. | M |
| FR81 | L'onboarding guide explicitement l'installation de la PWA sur l'écran d'accueil, avec des instructions distinctes pour iPhone et Android. | M |
| FR82 | Tout participant n'ayant pas activé les notifications push reçoit les messages **essentiels** par e-mail (défi du jour, annonces, relances). | M |
| FR83 | L'administrateur peut envoyer une notification à tous les participants, à une équipe ou à un segment. | M |
| FR84 | Le participant peut activer ou désactiver les notifications par catégorie. | M |
| FR85 | Une relance automatique est envoyée aux participants inactifs depuis plusieurs jours. | S |
| FR86 | Les notifications peuvent être programmées à l'avance. | S |

### 3.9 Fil d'actualité

| # | Exigence | Prio |
| --- | --- | --- |
| FR87 | Un fil d'actualité affiche les publications de l'organisation et les faits marquants du jeu. | M |
| FR88 | L'administrateur peut publier un message avec texte et image depuis le back-office. | M |
| FR89 | Le fil peut afficher automatiquement des faits marquants (défi collectif atteint, palier de collecte, carte rare obtenue). | S |
| FR90 | Les participants peuvent réagir ou commenter les publications. | C |

### 3.10 Back-office administrateur

| # | Exigence | Prio |
| --- | --- | --- |
| FR91 | L'accès au back-office est restreint aux comptes administrateurs. | M |
| FR92 | L'administrateur crée et modifie les défis du **catalogue** (type, sport, difficulté, durée, points, récompense). | M |
| FR93 | L'administrateur visualise l'état du catalogue : défis disponibles, taux d'utilisation, alerte de rupture. | M |
| FR94 | L'administrateur peut imposer un défi commun à tous pour une journée donnée. | M |
| FR95 | L'administrateur crée et publie de nouvelles cartes (visuel, nom, rareté, série). | M |
| FR96 | L'administrateur publie des messages dans le fil d'actualité. | M |
| FR97 | L'administrateur envoie des notifications ciblées. | M |
| FR98 | L'administrateur consulte et recherche la liste des participants avec leur niveau, leur statut Strava et leur activité. | M |
| FR99 | L'administrateur consulte le tableau de bord de la collecte : encaissements, remboursements, frais, montant net reversable, ventilation par niveau. | M |
| FR100 | L'administrateur exporte les données comptables dans un format tabulaire exploitable. | M |
| FR101 | L'administrateur exporte la liste des adresses de livraison des médailles par niveau. | M |
| FR102 | L'administrateur consulte les activités signalées comme aberrantes et arbitre chaque cas. | M |
| FR103 | L'administrateur peut suspendre ou exclure un participant, avec motif tracé. | S |
| FR104 | Le back-office est utilisable depuis un téléphone. | M |
| FR105 | Les actions administratives sensibles sont journalisées. | S |
| FR106 | L'administrateur peut prévisualiser un défi ou une carte avant publication. | S |

### 3.11 Intégrité du jeu (anti-triche)

| # | Exigence | Prio |
| --- | --- | --- |
| FR107 | Le système contrôle la cohérence des activités (vitesse, allure, durée, type déclaré) et signale les valeurs aberrantes. | M |
| FR108 | Une activité signalée n'est pas automatiquement rejetée : elle est mise en attente d'arbitrage administrateur. | M |
| FR109 | Les activités marquées comme manuelles ou importées sur Strava sont identifiées et traitées selon une règle explicite. | M |
| FR110 | Un même compte Strava ne peut être lié qu'à un seul compte de jeu. | M |
| FR111 | Un participant peut signaler un comportement suspect. | C |
| FR112 | Les seuils de détection sont paramétrables sans redéploiement. | S |

---

## 4. Exigences non fonctionnelles

| # | Exigence | Prio |
| --- | --- | --- |
| NFR1 | L'application est une PWA installable sur Android et iPhone. Aucune publication sur les stores. | M |
| NFR2 | L'interface est conçue pour mobile d'abord ; le back-office reste utilisable sur téléphone. | M |
| NFR3 | Toute l'interface utilisateur est en français. | M |
| NFR4 | Les pages principales s'ouvrent en moins de 3 secondes sur une connexion mobile 4G. | M |
| NFR5 | Le système supporte 800 participants actifs, avec un pic de charge à la publication du défi quotidien. | M |
| NFR6 | Le coût d'infrastructure récurrent reste inférieur à 30 € par mois hors commissions de paiement. *Tenu : ~25 €/mois sur les trois mois de l'édition, le VPS étant déjà payé.* | M |
| NFR7 | Une indisponibilité de Strava ne provoque aucune perte de données : les activités sont rattrapées au rétablissement. | M |
| NFR8 | Aucun secret n'est présent dans le dépôt ; toutes les clés passent par des variables d'environnement. | M |
| NFR9 | Les données utilisateur sont protégées par des règles d'accès au niveau de la base de données. | M |
| NFR10 | Les données personnelles sont hébergées dans l'Union européenne. | M |
| NFR11 | Les données d'activité sportive font l'objet d'une minimisation : seules les données nécessaires à l'évaluation des défis sont conservées. | M |
| NFR12 | Une durée de conservation des données d'activité est définie et appliquée après la fin de l'édition. | M |
| NFR13 | Les clés secrètes ne sont jamais exposées côté navigateur. | M |
| NFR14 | Les paiements sont traités par Stripe ; aucune donnée de carte ne transite ni n'est stockée par l'application. | M |
| NFR15 | Tout encaissement, remboursement et frais est enregistré de façon traçable et rapprochable avec Stripe. | M |
| NFR16 | Un webhook de paiement en échec est rejoué automatiquement, sans double comptabilisation. | M |
| NFR17 | Les données du jeu sont sauvegardées quotidiennement pendant toute la durée de l'édition. | M |
| NFR18 | Le contenu du jeu (défis, cartes, règles de tirage, seuils) est piloté par les données et modifiable sans déploiement. | M |
| NFR19 | Une couche d'abstraction « source d'activité » permet d'ajouter Garmin ultérieurement sans refonte. | M |
| NFR20 | Aucun avantage de classement ne peut être obtenu par un achat. | M |
| NFR21 | L'interface respecte la charte bleu / orange et n'utilise aucun élément d'identité de la fondation Movember. | M |
| NFR22 | L'application reste consultable en lecture si la synchronisation des activités est temporairement indisponible. | S |
| NFR23 | Accessibilité visée : WCAG 2.1 niveau AA sur les parcours publics et le parcours participant. | S |
| NFR24 | Le déploiement est automatisé depuis GitHub vers le VPS, avec un environnement de préproduction accessible au PO et un retour arrière possible en moins d'une minute. | M |
| NFR27 | Le serveur est supervisé en continu pendant l'édition, avec alerte en cas d'indisponibilité et redémarrage automatique des services. | M |
| NFR28 | Une procédure d'exploitation écrite (`docs/runbook.md`) permet au PO seul de redémarrer l'application, restaurer une sauvegarde ou revenir à la version précédente. | M |
| NFR25 | Les parcours critiques (paiement, connexion Strava, évaluation d'un défi) sont couverts par des tests automatisés. | M |
| NFR26 | Une page de statut interne permet de vérifier l'état des intégrations (Strava, Stripe, notifications). | S |

---

## 5. Objectifs d'interface et d'expérience

### 5.1 Vision d'ensemble

Une application qui se consulte **en dix secondes, une main sur le guidon**. L'écran
d'accueil du participant répond à trois questions et à trois seulement : *quel est le
défi du jour ?*, *où j'en suis ?*, *qu'est-ce que j'ai gagné ?* Tout le reste est en
second rang.

Le ton est celui d'un jeu, pas d'une plateforme de don : couleurs franches, animations à
l'obtention des cartes, compteurs qui progressent. La cause est présente et assumée, mais
elle n'est pas le sujet de chaque écran — c'est le sport qui l'est.

### 5.2 Principes d'interaction

- **Zéro saisie.** Le participant ne renseigne rien : il fait du sport, l'application se
  met à jour. La seule action attendue de lui est d'ouvrir l'application.
- **Retour immédiat.** Un défi validé, une carte obtenue : c'est visible et célébré tout
  de suite.
- **L'installation est un moment du parcours, pas une option.** Elle est présentée
  comme une étape de l'inscription, avec des instructions adaptées à l'appareil détecté.
- **Le back-office suit les mêmes règles.** Écrans courts, formulaires simples,
  prévisualisation avant publication.

### 5.3 Écrans principaux

**Public :** accueil et présentation du jeu · choix du niveau · tunnel de paiement ·
classements publics · galerie des cartes · CGV, confidentialité, mentions légales.

**Participant :** onboarding (compte → consentement → Strava → installation PWA) · accueil
avec le défi du jour · détail et historique des défis · album de collection · détail d'une
carte · classements individuel et par équipe · page d'équipe · fil d'actualité · profil et
paramètres (notifications, Strava, données personnelles, adresse de livraison).

**Administrateur :** tableau de bord · gestion des défis · gestion des cartes · fil
d'actualité · envoi de notifications · participants · équipes · collecte et export
comptable · file d'arbitrage anti-triche.

### 5.4 Accessibilité

**WCAG 2.1 niveau AA** visé sur les parcours publics et participant. Point d'attention
particulier : le couple bleu / orange doit conserver un contraste suffisant, notamment
sur les cartes et les états de défi, qui ne doivent jamais reposer sur la seule couleur
pour distinguer réussi de manqué.

### 5.5 Identité visuelle

Bleu et orange, thème sport et moustache. Identité propre au projet. **Aucun logo,
visuel ou élément d'identité de la fondation Movember**, et aucun élément d'interface
laissant croire qu'il s'agit de l'application officielle de la fondation. Les visuels
des cartes sont fournis par le PO, prêts à intégrer.

### 5.6 Plateformes cibles

PWA responsive, mobile d'abord. Safari iOS et Chrome Android récents. Consultation
possible sur ordinateur.

---

## 6. Hypothèses techniques

*Orientations transmises à l'Architecte comme contraintes. Les décisions fermes et leur
justification relèvent de la Phase 3.*

### 6.1 Structure du dépôt

**Monorepo.** Application, back-office et fonctions de traitement dans un seul dépôt.
Justification : une seule personne développe, le partage de modèles de données entre
l'application et le back-office est constant, et un découpage multi-dépôts ajouterait de
la coordination sans bénéfice.

### 6.2 Architecture applicative

**Application unique (monolithe) avec traitements asynchrones.** La synchronisation des
activités, l'évaluation des défis et l'envoi des notifications s'exécutent en tâche de
fond. Aucun découpage en micro-services : injustifiable à ce volume, à ce budget et dans
ce délai.

### 6.3 Exigences de test

**Tests unitaires + tests d'intégration sur les parcours critiques.** Sont couverts en
priorité : le tunnel de paiement et ses webhooks, la liaison Strava et le rafraîchissement
des jetons, l'évaluation des défis, l'attribution des cartes, et le calcul des
classements. Le reste est vérifié manuellement selon une liste de contrôle avant
l'ouverture des inscriptions. Une pyramide de tests complète n'est pas soutenable dans le
délai imparti.

### 6.4 Autres hypothèses transmises à l'Architecte

- Stack : Next.js + TypeScript, Tailwind, Supabase, Stripe. **Hébergement sur le VPS
  Hostinger du PO** (décision prise en Phase 3), avec conteneurisation Docker et
  déploiement automatisé depuis GitHub.
- Le contenu du jeu doit être piloté par les données. C'est la contrainte d'architecture
  la plus structurante du projet : elle conditionne la promesse du back-office.
- Une couche d'abstraction « source d'activité » doit isoler Strava dès le départ.
- Le mode de récupération des activités (webhooks ou interrogation périodique) doit être
  arbitré explicitement, avec sa gestion de quota et son comportement en cas de panne.
- Les notifications Web Push nécessitent un service worker et des clés VAPID ; le repli
  e-mail doit être conçu comme un canal de premier rang, pas comme une rustine.
- La traçabilité comptable doit permettre un rapprochement ligne à ligne avec Stripe.
- Estimation du coût mensuel d'infrastructure pour 400 à 800 participants actifs.
- **Dépendance externe bloquante :** l'accès à l'API Strava au-delà du quota par défaut
  et la conformité de l'usage prévu (classements entre athlètes) au contrat développeur
  Strava. Ces deux points ne sont pas résolus à la date de ce document et conditionnent
  la faisabilité du concept.

---

## 7. Liste des epics

Les epics sont ordonnés selon le chemin critique vers le 1ᵉʳ novembre. Chacun livre un
incrément déployable et vérifiable.

| # | Epic | Objectif | Prio |
| --- | --- | --- | --- |
| **1** | **Fondations et squelette déployable** | Mettre en place le projet, la conteneurisation, la chaîne de déploiement vers le VPS avec préproduction, la PWA installable, l'authentification et la page d'accueil publique aux couleurs du jeu. | M |
| **2** | **Inscription payante** | Permettre à un visiteur de choisir un niveau, de payer via Stripe et d'obtenir un compte participant actif, avec la traçabilité comptable associée. | M |
| **3** | **Connexion Strava et synchronisation** | Lier le compte Strava du participant et récupérer ses activités automatiquement et durablement, dans le respect du RGPD. | M |
| **4** | **Moteur de défis** | Constituer le catalogue, attribuer chaque jour un défi individuel à chaque participant, l'évaluer automatiquement, et gérer les défis cumulables et non bloquants. | M |
| **5** | **Cartes et collection** | Attribuer une carte tirée au sort à chaque défi réussi et offrir un album consultable, avec mise en scène de l'obtention. | M |
| **6** | **Notifications et installation PWA** | Garantir que chaque participant est prévenu chaque jour, par push ou par e-mail, avec un onboarding d'installation guidé. | M |
| **7** | **Équipes et classements** | Créer la dimension collective et les sept classements, et donner à l'organisation un canal de publication. | M |
| **8** | **Back-office d'animation** | Donner à l'équipe organisatrice l'autonomie complète sur les défis, les cartes, les notifications et les participants, sans développement. | M |
| **9** | **Collecte, comptabilité et intégrité du jeu** | Fournir le tableau de bord de collecte, les exports comptables et de livraison, et les outils d'arbitrage anti-triche. | M |
| **10** | **Packs achetables et bonus** | Permettre l'achat de packs de cartes en cours de jeu, sans aucun impact sur le classement. | S |
| **11** | **Conformité, durcissement et préparation au lancement** | RGPD complet, CGV, accessibilité, tests de charge, jeu de données de répétition générale. | M |

**Note de séquencement.** Les epics 1 à 6 constituent le chemin critique absolu : sans
eux, il n'y a pas de jeu le 1ᵉʳ novembre. L'epic 8 (back-office) est indispensable mais
peut être livré par tranches — la création des défis d'abord, le reste ensuite. L'epic 10
est le seul du MVP à pouvoir glisser après le 1ᵉʳ novembre : les packs du niveau 3 sont
attribués automatiquement (epic 5) et n'en dépendent pas.

**Attention particulière sur l'epic 3.** Il est le seul dont la faisabilité dépend d'un
tiers. Tant que le quota Strava n'est pas relevé et que la conformité de l'usage n'est pas
confirmée, il porte un risque qu'aucune décision technique ne peut lever.

Le découpage détaillé en stories relève de la Phase 4 (PO et Scrum Master) et sera produit
dans `docs/epics/` et `docs/stories/`.

---

## 8. Feuille de route

### 8.1 MVP — livré et stable au 1ᵉʳ novembre 2026

Tout ce qui est marqué **M** dans les sections 3 et 4. En résumé : un visiteur peut
découvrir le jeu, payer, connecter son Strava, installer l'application, recevoir un défi
par jour, le voir validé automatiquement, gagner des cartes, suivre son classement et
celui de son équipe — pendant que l'équipe organisatrice anime le mois depuis son
téléphone et dispose à la fin d'un export comptable exploitable.

### 8.2 Livrable si le calendrier le permet

Les exigences marquées **S** : achat de packs à l'unité, relances automatiques des
inactifs, pages d'équipe enrichies, faits marquants automatiques dans le fil,
remboursements en autonomie depuis le back-office, resynchronisation manuelle, page de
statut des intégrations.

### 8.3 Version 2 — après le lancement

Les exigences marquées **C**, plus les chantiers de fond : **intégration Garmin** (lot
indépendant, hors MVP), offre entreprise avec facturation groupée, partage social des
cartes, commentaires sur le fil, changement de niveau en cours d'édition, mécanique de
joker et de rattrapage.

### 8.4 Explicitement exclu de cette édition

Application native sur les stores · saisie manuelle des activités · reçus fiscaux et
CERFA · imagerie officielle Movember · échange de cartes entre participants · application
multilingue · codes de réduction.

### 8.5 Jalons

| Jalon | Date cible |
| --- | --- |
| Validation de l'architecture (Phase 3) | mi-août |
| Découpage en epics et stories (Phase 4) | mi-août |
| Squelette déployable (epic 1) | fin août |
| Parcours payant complet (epic 2) | début septembre |
| Strava opérationnel de bout en bout (epic 3) | mi-septembre |
| Défis et cartes fonctionnels (epics 4-5) | fin septembre |
| **Gel des fonctionnalités** | **~1ᵉʳ octobre** |
| Répétition générale sur données de test | première quinzaine d'octobre |
| **Ouverture des inscriptions** | **mi-octobre** |
| **Lancement du jeu** | **1ᵉʳ novembre** |
| Clôture du jeu | 30 novembre |
| Expédition des médailles et reversement | décembre |

---

## 9. Points restant à trancher

Ces points n'empêchent pas de démarrer la Phase 3, mais devront être arbitrés avant la
Phase 4 ou en cours de développement.

| # | Point | Échéance |
| --- | --- | --- |
| P1 | **Prix ferme de la médaille**, qui conditionne la répartition définitive du don par niveau (décision D1). | Avant l'ouverture des inscriptions |
| P2 | Annonce du « 100 % reversé » au niveau 1 : reformuler, ou faire combler les frais Stripe par l'association (~260 € pour 600 participants). | Avant l'ouverture des inscriptions |
| ~~P12~~ | ~~Contradiction sur la « carte légendaire garantie »~~ ✅ **Tranché** : les raretés sont commune, rare, épique, légendaire — « très rare » supprimée, « légendaire » ajoutée au sommet. La promesse du niveau 3 est désormais exacte. | — |
| P3 | **Prix** des packs achetables, et **probabilités de tirage par rareté**. *(Composition tranchée : 5 cartes. Rythme tranché : 1 carte par défi réussi.)* | Phase 4 |
| P13 | Barème de points par difficulté de défi — rapport proposé de 1 à 3 entre facile et difficile. | Phase 4 |
| P14 | Volume cible du catalogue de défis : au moins 60 à 80 défis répartis par sport et par difficulté. **Travail de contenu à mener en septembre.** | Septembre |
| ~~P4~~ | ~~Classement par équipe : total ou moyenne~~ ✅ **Tranché** : normalisé par le nombre de membres, pour ne pas désavantager les petites équipes. | — |
| P5 | Taille minimale et maximale d'une équipe ; qui peut en créer une. | Phase 4 |
| P6 | Politique de remboursement (blessure, abandon, erreur de niveau) — conditionne les CGV. | Avant l'ouverture des inscriptions |
| P7 | Traitement d'un participant qui paye puis refuse de connecter Strava. | Avant l'ouverture des inscriptions |
| P8 | Inscriptions encore possibles après le 1ᵉʳ novembre ? Avec quel rattrapage sur les défis passés ? | Phase 4 |
| P9 | Modalités de la formule entreprise (facturation groupée ou inscriptions individuelles). | V2 |
| ~~P10~~ | ~~Durée de conservation des données d'activité après la fin de l'édition.~~ ✅ **Tranché — 12 mois.** | — |
| P11 | Traitement des activités marquées comme manuelles ou importées sur Strava : exclues, ou acceptées sous contrôle ? | Phase 3 |

---

## 10. Prochaines étapes

### 10.1 Passation à l'Architecte

Ce PRD définit le quoi et le pourquoi du projet DEFI Movember. L'Architecte doit produire
`docs/architecture.md` en traitant explicitement, chacun avec ses compromis et
l'alternative écartée :

1. La stack complète et sa justification, sous le critère d'arbitrage du projet : à
   qualité égale, le moins cher en récurrent, le plus simple à maintenir, le plus rapide
   à livrer.
2. **La PWA et les notifications** : service worker, installabilité, parcours guidé iOS
   et Android, service d'envoi, comportement de repli.
3. **L'intégration Strava** : OAuth, webhooks ou interrogation périodique, quotas,
   rafraîchissement des jetons, conditions d'utilisation, comportement en cas de panne.
4. **La couche d'abstraction « source d'activité »** permettant d'ajouter Garmin sans
   refonte.
5. **Le modèle de données du moteur de défis et de cartes**, permettant la création de
   contenu en cours de mois sans redéploiement — exigence structurante NFR18.
6. **Stripe** : inscriptions, packs, webhooks, remboursements, traçabilité comptable
   rapprochable.
7. **L'anti-triche** : contrôles de cohérence, file d'arbitrage.
8. **Le RGPD** : minimisation, conservation, consentement, export, suppression.
9. **Le coût mensuel estimé** de l'infrastructure pour 400 à 800 participants.
10. **La stratégie de déploiement** compatible avec un développement en Claude Code Cloud
    sur GitHub.

### 10.2 Note pour l'expert UX

Une spécification UX formelle n'est pas prévue au vu du calendrier ; la section 5 de ce
document en tient lieu. Si le PO souhaite un travail de conception d'interface dédié, il
doit être lancé en parallèle de la Phase 3 et ne pas retarder le développement.
