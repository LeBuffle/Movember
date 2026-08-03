# Project Brief : DEFI Movember

| | |
| --- | --- |
| **Version** | v1 — Phase 1 BMAD (Analyst) |
| **Date** | 3 août 2026 |
| **Auteur** | Agent Analyst (BMAD), sur saisie de Sylvain (Product Owner) |
| **Statut** | En attente de validation PO |
| **Porteur** | Association loi 1901 — Table Ronde Française |

---

## 1. Résumé exécutif

**DEFI Movember** est une application web installable (PWA) qui transforme une collecte
de fonds au profit de la fondation Movember en jeu sportif collectif d'un mois.

Les participants payent une inscription (3 niveaux, de 12 € à 50 €), connectent leur
compte Strava, et relèvent **un défi sportif par jour pendant tout le mois de
novembre**. Leurs activités sont récupérées automatiquement depuis Strava — aucune
saisie manuelle. Chaque défi réussi débloque des **cartes à collectionner** sur le
thème sport / moustache, réparties en niveaux de rareté, et alimente un classement
individuel et par équipe.

**Le problème résolu :** une collecte classique repose sur un don passif — on donne une
fois, il ne se passe plus rien, et l'engagement retombe. Côté organisateur, animer
30 jours de collecte suppose un suivi manuel épuisant.

**La cible :** environ 100 à 500 sportifs amateurs déjà équipés d'une montre ou d'une
application de suivi, recrutés d'abord dans le réseau de la Table Ronde Française, puis
élargis à d'autres associations, à des entreprises et au grand public.

**La proposition de valeur :** on ne demande pas aux participants de changer de
comportement. Ils courent, roulent, marchent et nagent déjà, et enregistrent déjà leurs
sorties. L'application se branche sur cette habitude existante et la transforme en jeu.

**Contexte majeur :** ce n'est pas un projet neuf. C'est la **5ᵉ édition** du défi
Movember de la Table Ronde Française, avec une refonte complète de l'outil. Le concept
est déjà validé sur le terrain ; ce qui est neuf, c'est la plateforme.

> ⚠️ Projet **indépendant** de la fondation Movember. Accord obtenu, mais aucun usage de
> la marque, du logo ou de l'imagerie officielle.

---

## 2. Énoncé du problème

### 2.1 État actuel et points de douleur

**Côté participant.** Les collectes Movember reposent sur un geste unique : on donne, on
partage éventuellement le lien, et c'est terminé. Rien ne se passe entre le don et la
fin du mois. Pour un sportif amateur, aucun lien n'est fait entre l'effort qu'il fournit
déjà quotidiennement et la cause qu'il soutient. L'engagement retombe dans les premiers
jours.

**Côté organisateur.** Les quatre éditions précédentes ont montré le coût réel de
l'animation : suivi manuel des performances, relances individuelles, publications
rédigées à la main, classements tenus à jour à la main. Animer 30 jours mobilise du
temps bénévole de façon continue, et ce temps est le facteur limitant du nombre de
participants qu'on peut accueillir.

**Côté croissance.** C'est le point qui déclenche la refonte. Les quatre premières
éditions sont restées dans le périmètre de l'association. Pour ouvrir à d'autres
associations, à des entreprises et au grand public, le suivi manuel ne tient plus : il
faut un outil qui absorbe la charge d'animation.

### 2.2 Pourquoi les solutions existantes ne suffisent pas

| Solution existante | Ce qu'elle fait bien | Ce qui manque |
| --- | --- | --- |
| Plateforme officielle Movember | Collecte, pages et équipes, crédibilité de la marque | Aucune gamification, aucun défi quotidien, aucune connexion sportive automatique |
| Challenges Strava | Défis sportifs automatiques, gros volume | Aucune collecte de fonds, aucune animation éditoriale, aucune contrepartie |
| HelloAsso / Leetchi | Encaissement associatif simple, frais faibles | Pur outil de paiement, aucune dimension jeu |
| Plateformes sport-solidaire (km convertis en dons) | Lien effort ↔ don | Pas de collection, pas de défis quotidiens variés, pas d'animation en direct |

**Aucune solution existante ne combine les trois briques du projet :** inscription
payante, défis quotidiens animés en direct par l'organisateur, et collection de cartes
gamifiée. C'est précisément cette combinaison qui fait l'intérêt du projet — et c'est
aussi ce qui explique qu'il faille le construire.

### 2.3 Urgence

Le calendrier est **calé sur le mois de novembre** et n'est pas négociable. Les
inscriptions doivent ouvrir mi-octobre, le jeu démarre le 1ᵉʳ novembre. À la date de ce
document (3 août 2026), il reste **environ 10 semaines** avant l'ouverture des
inscriptions, et **8 semaines** avant le gel des fonctionnalités. Un projet reporté
n'est pas un projet en retard : c'est un projet annulé pour un an.

---

## 3. Solution proposée

### 3.1 Concept

Une PWA installable sur Android et iPhone, articulée autour de quatre boucles.

**La boucle d'entrée (une fois).** Le visiteur découvre la cause et le jeu sur une page
publique, choisit son niveau d'inscription, paye, crée son compte, connecte son Strava
et installe l'application sur son écran d'accueil. Le paiement précède tout accès au
jeu.

**La boucle quotidienne (30 fois).** Chaque jour, un nouveau défi est publié. Le
participant reçoit une notification. Il sort faire son sport comme d'habitude. Son
activité remonte automatiquement de Strava, le défi est évalué et validé, une carte
tombe, une notification le lui annonce.

**La boucle de collection (continue).** Les cartes obtenues alimentent un album
consultable. Les niveaux de rareté créent l'envie de compléter. Des packs achetables en
cours de jeu permettent d'accélérer — et alimentent la collecte.

**La boucle d'animation (côté organisateur).** Depuis un back-office, l'équipe crée et
publie de nouveaux défis, de nouvelles cartes et des annonces au fil du mois, sans
compétence technique et sans intervention de développement.

### 3.2 Différenciateurs

1. **Zéro friction sportive.** Aucune saisie manuelle. On se branche sur une habitude
   déjà installée plutôt que d'en créer une nouvelle.
2. **Un jeu vivant, pas un site figé.** Le back-office permet de réagir en cours de
   mois : lancer un défi surprise, publier une carte événementielle, relancer les
   inactifs. C'est la différence entre une plateforme et une animation.
3. **Une contrepartie tangible.** Médaille physique et cartes à collectionner : on
   n'achète pas un reçu, on achète une expérience et un objet.
4. **Une dimension collective.** Les équipes permettent d'embarquer une association
   entière ou une entreprise d'un bloc, ce qui est le principal levier de croissance
   identifié pour cette 5ᵉ édition.

### 3.3 Pourquoi ce projet peut réussir là où d'autres échoueraient

Le concept est **déjà validé par quatre éditions**. On n'invente pas un marché : on
outille une pratique qui existe et qui fonctionne. Le public de départ est **acquis et
identifié** (le réseau de la Table Ronde Française), ce qui supprime le risque de
lancer une plateforme vide. Enfin, le projet est porté par des bénévoles qui sont
eux-mêmes le public cible.

---

## 4. Utilisateurs cibles

### 4.1 Segment principal : le sportif amateur participant

**Profil.** Adulte, sportif régulier ou occasionnel — course à pied, vélo, marche,
natation, salle. Déjà équipé d'une montre connectée ou d'une application de suivi, et
**déjà utilisateur de Strava** ou prêt à créer un compte. Majoritairement issu du réseau
associatif de la Table Ronde Française pour cette édition, avec une ouverture progressive
vers d'autres associations, des entreprises et le grand public.

**Comportement actuel.** Il enregistre déjà ses sorties, consulte ses statistiques,
compare ses performances. Il connaît les classements Strava et les segments. La
mécanique de défi lui est familière.

**Ce qui le motive.** Dans l'ordre observé : le défi et la performance personnelle, la
comparaison avec les autres, la collection et la complétion, l'appartenance à une équipe
— et la cause, qui fournit la justification et le sens, mais rarement le moteur
quotidien.

**Ses points de douleur.** Il ne veut pas d'une contrainte supplémentaire dans sa
routine. Toute étape manuelle est une occasion d'abandon. Il veut savoir immédiatement
si son effort a compté.

**Volume attendu.** 100 à 500 participants sur l'édition.

### 4.2 Segment secondaire : l'administrateur / animateur

**Profil.** Sylvain et l'équipe organisatrice de l'association. **Aucune compétence
technique.** Bénévoles, disponibles par créneaux courts, souvent depuis un téléphone.

**Ce qu'il doit pouvoir faire seul.** Créer et programmer les défis du mois, publier de
nouvelles cartes, envoyer des notifications, suivre la collecte, gérer les participants,
arbitrer les cas litigieux, exporter les données comptables.

**Son point de douleur.** Sur les éditions précédentes, l'animation était intégralement
manuelle. Si le back-office n'est pas réellement autonome, la refonte n'apporte rien :
elle déplace le travail manuel au lieu de le supprimer.

### 4.3 Segment tertiaire : le visiteur public

Personne qui découvre le projet via un partage ou une communication. Il doit comprendre
en moins d'une minute : la cause, la règle du jeu, le prix, ce qu'il obtient, et le fait
qu'il ne s'agit **pas** d'un don défiscalisé. C'est le segment le plus large et celui qui
conditionne la croissance vers le grand public.

---

## 5. Objectifs et métriques de succès

### 5.1 Objectifs métier

- **Collecter au minimum le résultat de l'édition 4**, avec pour cible haute un
  doublement du nombre de participants. *(Cible chiffrée à confirmer — voir question
  ouverte Q1.)*
- **Atteindre 300 participants inscrits et payés** au 1ᵉʳ novembre, avec un plancher
  acceptable à 100 et un objectif ambitieux à 500.
- **Recruter au moins 3 entités externes** (association, entreprise ou club) inscrivant
  une équipe, afin de valider le levier de croissance de cette 5ᵉ édition.
- **Réduire la charge d'animation à moins de 30 minutes par jour** pour l'équipe
  organisatrice pendant le mois de novembre.
- **Maintenir le coût d'infrastructure sous 30 € par mois**, hors commissions de
  paiement.

### 5.2 Métriques de succès utilisateur

- **Taux de complétion de l'inscription** : plus de 80 % des personnes qui payent vont
  jusqu'à la connexion Strava effective.
- **Taux d'installation de la PWA** : plus de 70 % des participants installent
  l'application sur leur écran d'accueil (condition des notifications sur iPhone).
- **Rétention au jeu** : plus de 60 % des participants valident encore au moins un défi
  dans la dernière semaine de novembre.
- **Défis validés par participant** : médiane supérieure à 15 défis sur les 30.
- **Zéro réclamation** sur une activité correctement enregistrée sur Strava mais non
  prise en compte par le jeu.

### 5.3 Indicateurs clés (KPI)

| KPI | Définition | Cible |
| --- | --- | --- |
| Participants payants | Inscriptions payées et confirmées | 300 (min. 100) |
| Montant total encaissé | Somme brute Stripe (inscriptions + packs) | à définir (Q1) |
| Montant net reversé | Encaissé − frais Stripe − coût des médailles − infra | à définir (Q1) |
| Taux de connexion Strava | Comptes Strava liés ÷ inscriptions payées | > 90 % |
| Participants actifs jour J | Au moins une activité synchronisée dans les 24 h | > 50 % en moyenne |
| Défis validés / participant | Médiane sur le mois | > 15 / 30 |
| Cartes débloquées | Nombre moyen de cartes par participant | > 20 |
| Revenu des packs | Chiffre d'affaires des achats en cours de jeu | à définir (Q3) |
| Litiges anti-triche | Cas nécessitant un arbitrage manuel | < 2 % des validations |
| Coût infra mensuel | Hébergement + base + envoi de notifications | < 30 € |

### 5.4 Économie du projet — à instruire en Phase 2

Les trois niveaux d'inscription tels que définis à ce jour :

| Niveau | Nom | Prix | Reversé à la fondation | Contrepartie |
| --- | --- | --- | --- | --- |
| 1 | Sportif engagé | 12 € | 12 € (annoncé « 100 % ») | Accès au jeu |
| 2 | Sportif chevronné | 30 € | 12 € | Accès au jeu + médaille premium envoyée en fin de défi |
| 3 | Sportif légendaire | 50 € | 12 € | Niveau 2 + 2 packs de cartes dont une légendaire garantie |

**Trois observations que le PRD devra trancher :**

**a) Le don ne progresse pas avec le prix.** Un « sportif légendaire » à 50 € reverse le
même montant à la fondation qu'un « sportif engagé » à 12 €. Les 38 € d'écart financent
la médaille et les cartes. C'est défendable — ce sont des achats avec contrepartie — mais
c'est contre-intuitif pour un participant qui pense « payer plus = donner plus ». Il faut
soit assumer et l'expliquer clairement, soit indexer une part du don sur le niveau.

**b) « 100 % du montant remis en don » est arithmétiquement faux.** Stripe prélève une
commission sur chaque encaissement — de l'ordre de 1,5 % + 0,25 € pour une carte
européenne, soit environ **0,43 € sur 12 €**. Le montant réellement disponible est donc
d'environ 11,57 €. Annoncer « 100 % » sans nuance expose l'association à un reproche de
communication trompeuse. Deux issues possibles : reformuler (« l'intégralité du montant
net des frais bancaires »), ou que l'association complète la différence sur ses fonds
propres et puisse alors l'annoncer sans réserve.

**c) La marge de la médaille est étroite.** Au niveau 2, il reste environ 17,30 € après
le don de 12 € et les frais Stripe, pour financer une médaille « ultra premium », son
conditionnement et son expédition. Selon la qualité visée et le volume, cette marge peut
devenir négative. La médaille est **le seul poste de coût variable du projet** et le seul
capable de transformer une collecte réussie en perte financière. Elle doit être chiffrée
et arbitrée avant l'ouverture des inscriptions.

**Ordre de grandeur du reversement**, sur la base de 12 € par participant :

| Participants | Reversement (hors packs) |
| --- | --- |
| 100 | ~1 200 € |
| 300 | ~3 600 € |
| 500 | ~6 000 € |

Le revenu des packs achetés en cours de jeu vient s'y ajouter — sa destination (don
intégral, ou financement des coûts) reste à décider.

---

## 6. Périmètre du MVP

Le MVP, c'est ce qui doit être **stable et opérationnel le 1ᵉʳ novembre**. Tout ce qui
n'est pas strictement nécessaire à ce moment est renvoyé après le lancement.

### 6.1 Fonctionnalités indispensables

- **Page d'accueil publique** — cause, règles du jeu, tarifs des 3 niveaux, compteur de
  collecte, mention d'indépendance vis-à-vis de la fondation, mention explicite « pas de
  reçu fiscal ». *C'est la porte d'entrée : sans elle, aucun recrutement.*
- **Paiement de l'inscription** — choix du niveau, paiement Stripe, confirmation. Le
  paiement conditionne l'accès au jeu. *Sans encaissement, pas de collecte.*
- **Compte et authentification** — création de compte, connexion, récupération de mot de
  passe.
- **Connexion Strava** — parcours OAuth en un minimum de clics. *C'est la brique qui rend
  tout le reste automatique ; sans elle il n'y a pas de jeu.*
- **Synchronisation automatique des activités** — récupération continue sur toute la
  durée du jeu, sans action du participant.
- **Moteur de défis** — un défi par jour, évalué automatiquement. Types couverts au MVP :
  distance, durée, dénivelé, régularité, multi-sports, collectif, surprise.
- **Cartes à collectionner** — environ 50 cartes au lancement, 3 à 5 niveaux de rareté,
  déblocage par la réussite des défis, album consultable.
- **Notifications push** — nouveau défi, défi validé, carte obtenue, annonces de
  l'organisation. Avec **parcours d'installation guidé** de la PWA (obligatoire sur
  iPhone) et **repli par e-mail** pour ceux qui n'installent pas. *Exigence forte, non
  négociable.*
- **Classements et progression** — individuel et par équipe.
- **Équipes** — création, rejoindre une équipe, classement collectif. *Levier de
  croissance central de cette édition.*
- **Fil d'actualité du jeu** — publications de l'organisation, faits marquants.
- **Back-office administrateur** — création et publication de défis, de cartes et
  d'annonces **en cours de mois sans redéploiement**, envoi de notifications, gestion des
  participants, modération, arbitrage anti-triche.
- **Tableau de bord de collecte + export comptable** — encaissements, remboursements,
  frais, total. *Obligation de l'association pour reverser les fonds.*
- **Conformité RGPD** — consentement explicite sur les données d'activité, export et
  suppression de compte, politique de confidentialité, CGV sans ambiguïté sur l'absence
  de reçu fiscal.

### 6.2 Hors périmètre du MVP

- **Packs achetables en cours de jeu.** Fonctionnalité désirable mais non bloquante au
  1ᵉʳ novembre : le jeu fonctionne sans. À livrer si l'avance le permet, sinon en
  cours de mois. *Note : le niveau 3 inclut 2 packs — l'attribution de ces packs, elle,
  fait partie du MVP ; c'est leur achat à l'unité qui peut attendre.*
- **Intégration Garmin.** Explicitement hors MVP. Traitée comme un lot indépendant,
  activable après le lancement, sans remise en cause de l'architecture.
- **Application native sur les stores.** Non-objectif permanent.
- **Saisie manuelle des activités.** Non-objectif permanent : seules les activités
  remontées par l'API font foi.
- **Reçus fiscaux et CERFA.** Non-objectif permanent et juridiquement assumé.
- **Imagerie officielle Movember.** Non-objectif permanent.
- **Échange de cartes entre participants.** Attrayant, mais complexité et risques d'abus
  disproportionnés pour une première édition.
- **Multi-édition / réutilisation annuelle automatisée.** À viser en conception, pas à
  livrer.
- **Application multilingue.** France / UE, en français uniquement.

### 6.3 Critère de réussite du MVP

> Le 1ᵉʳ novembre, au moins 100 participants ont payé, ont connecté leur compte Strava et
> reçoivent le défi du jour par notification. Chaque jour du mois, leurs activités sont
> récupérées automatiquement, les défis sont validés sans intervention, et l'équipe
> organisatrice publie l'animation du jour depuis le back-office sans faire appel à un
> développeur. Fin novembre, l'association dispose d'un export comptable exploitable pour
> effectuer son don.

---

## 7. Vision après le MVP

### 7.1 Phase 2 — pendant et juste après novembre

Achat de packs à l'unité si non livré au MVP · intégration Garmin en lot indépendant ·
extension de la collection de cartes en cours de mois si le volume d'achats le justifie ·
défis inter-équipes et animations entre entreprises · partage social des cartes obtenues.

### 7.2 Vision à un ou deux ans

Faire de l'outil la **plateforme de référence des éditions suivantes** de la Table Ronde
Française, réutilisable d'une année sur l'autre sans redéveloppement : nouvelle édition,
nouvelle collection de cartes, nouveaux défis, mêmes fondations. À terme, un outil
mutualisable par d'autres associations organisant leur propre défi sportif solidaire.

### 7.3 Opportunités d'extension

Offres entreprises (équipe clé en main, page dédiée, facturation) · sources d'activité
supplémentaires (Apple Health, Google Fit, Polar, Suunto) via la couche d'abstraction
prévue en architecture · white-label pour d'autres causes que Movember · éditions
saisonnières hors novembre.

---

## 8. Considérations techniques

*Orientations initiales — les décisions fermes relèvent du document d'Architecture
(Phase 3).*

### 8.1 Exigences de plateforme

- **Plateformes cibles :** PWA installable, mobile d'abord. Android et iPhone.
  Consultation possible sur ordinateur, notamment pour le back-office.
- **Navigateurs / OS :** Safari iOS récent, Chrome Android récent. Contrainte
  structurante : sur iPhone, les notifications push ne fonctionnent **que** si
  l'utilisateur a ajouté la PWA à son écran d'accueil.
- **Performance :** ouverture rapide sur réseau mobile, usage possible en extérieur avec
  une connexion dégradée. Pic de charge attendu à la publication du défi quotidien et à
  l'envoi des notifications.

### 8.2 Préférences technologiques

| Brique | Orientation par défaut |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript, en PWA |
| Styling | Tailwind CSS, charte bleu / orange |
| Backend, base, authentification | Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions) |
| Paiement | Stripe, compte au nom de l'association |
| Hébergement | Vercel (alternative : VPS Hostinger) |
| Notifications | Web Push via service worker + repli e-mail |

Ces choix sont retenus par défaut pour leur cohérence avec les autres projets du PO, leur
coût quasi nul à ce volume, et leur rapidité de mise en œuvre. Ils devront être justifiés
ou écartés en Phase 3.

### 8.3 Considérations d'architecture

- **Dépôt :** monorepo unique. Une branche par story, PR et squash merge dans `main`.
- **Architecture applicative :** application unique avec traitements en tâche de fond
  pour la synchronisation Strava et l'envoi des notifications. Pas de découpage en
  micro-services : injustifiable à ce volume et à ce budget.
- **Intégrations requises :** Strava (obligatoire), Stripe (obligatoire), service d'envoi
  d'e-mails (repli notifications), Web Push. Garmin en option différée.
- **Point d'architecture structurant n° 1 :** une **couche d'abstraction « source
  d'activité »** dès le départ, pour que Garmin — ou toute autre source — s'ajoute plus
  tard sans refonte.
- **Point d'architecture structurant n° 2 :** le **moteur de défis et de cartes doit être
  piloté par les données**, pas par le code. Créer un défi ou une carte en cours de mois
  doit être une saisie dans le back-office, jamais un déploiement.
- **Sécurité et conformité :** aucun secret dans le dépôt · Row Level Security sur toutes
  les tables contenant des données utilisateur · les données d'activité sportive
  (localisation, rythme cardiaque, santé) sont des données personnelles à traitement
  sensible · minimisation, durée de conservation limitée, consentement explicite, export
  et suppression de compte · marché France / UE, hébergement des données dans l'UE
  recommandé.

---

## 9. Contraintes et hypothèses

### 9.1 Contraintes

- **Budget :** quasi nul. Seuls coûts admis : hébergement, commissions de paiement, et le
  coût des médailles. Chaque euro de frais technique est un euro en moins pour la
  collecte. Arbitrage permanent : à qualité égale, le moins cher en récurrent, le plus
  simple à maintenir, le plus rapide à livrer.
- **Calendrier — non négociable :**

  | Jalon | Date | Marge restante au 3 août |
  | --- | --- | --- |
  | Gel des fonctionnalités | ~1ᵉʳ octobre | ~8 semaines |
  | Ouverture des inscriptions | mi-octobre | ~10 semaines |
  | Lancement du jeu | 1ᵉʳ novembre | ~13 semaines |
  | Clôture | 30 novembre | — |
  | Expédition des médailles | décembre | — |

- **Ressources :** une seule personne côté humain (Sylvain, Product Owner, non
  développeur). Le développement est assuré par l'agent. Pas de designer, pas de
  testeur, pas d'équipe de support. Cela plafonne mécaniquement la complexité
  admissible.
- **Techniques :** PWA uniquement, pas de store · pas de saisie manuelle d'activité ·
  Strava obligatoire · notifications push obligatoires · Stripe imposé · charte propre
  sans imagerie Movember.
- **Juridiques :** les sommes versées sont des frais d'inscription et des achats avec
  contrepartie, **pas des dons ouvrant droit à réduction d'impôt**. Aucun reçu fiscal,
  aucun CERFA. Cela doit être annoncé sans ambiguïté dans l'application et dans les CGV.

### 9.2 Hypothèses clés

À valider — chacune, si elle est fausse, modifie le projet :

- La grande majorité des participants **a déjà un compte Strava** ou en créera un sans
  friction majeure.
- L'API Strava **autorisera l'usage prévu** (récupération des activités, classements
  entre participants) dans les conditions de son contrat développeur.
- Strava **relèvera le quota** de l'application à un niveau compatible avec 100 à 500
  athlètes connectés, dans le délai imparti.
- Une majorité de participants **acceptera d'installer la PWA** sur son écran d'accueil.
- Le public de la Table Ronde Française **répondra présent** au moins au niveau des
  éditions précédentes.
- Les visuels des ~50 cartes seront **fournis par le PO** en temps voulu, prêts à
  intégrer.
- Le compte Stripe de l'association sera **validé et opérationnel** avant la mi-octobre.
- Une médaille « ultra premium » peut être produite et expédiée **dans l'enveloppe
  disponible** (~17 € par unité au niveau 2).
- L'équipe organisatrice sera **disponible quotidiennement** en novembre pour animer.
- Un défi peut être évalué de façon fiable à partir des seules données remontées par
  l'API Strava.

---

## 10. Risques et questions ouvertes

### 10.1 Risques majeurs

| # | Risque | Gravité | Description et impact |
| --- | --- | --- | --- |
| **R1** | **Conditions d'utilisation de l'API Strava** | 🔴 Critique | Le contrat développeur de Strava encadre strictement ce qu'on peut faire des données d'un athlète — en particulier leur affichage à d'autres athlètes et la construction de classements. Or les classements et le partage sont au cœur du jeu. Si l'usage prévu n'est pas autorisé, **le concept doit être revu**, pas seulement l'implémentation. *À vérifier en priorité absolue, avant toute décision d'architecture.* |
| **R2** | **Quota d'athlètes de l'application Strava** | 🔴 Critique | Une application Strava nouvellement créée est plafonnée à un très petit nombre d'athlètes connectés tant que Strava n'a pas relevé la limite. La demande d'augmentation passe par Strava, avec un **délai non maîtrisé**. Rien n'est engagé à ce jour. Sans relèvement, l'application ne peut accueillir ni 100 ni 500 participants. |
| **R3** | **Compte Stripe non ouvert** | 🔴 Critique | La vérification d'identité d'une association par Stripe (statuts, procès-verbaux, dirigeants, IBAN) peut prendre plusieurs semaines. Le compte n'est pas lancé. **Sans Stripe validé, aucune inscription n'est possible à la mi-octobre.** |
| **R4** | **Coût et logistique des médailles** | 🟠 Élevé | Seul poste de coût variable du projet. Marge estimée ~17 € par médaille, conditionnement et expédition compris. Une mauvaise estimation, ou un volume mal anticipé, peut rendre la marge négative et transformer une collecte réussie en perte. S'ajoutent : la collecte et la conservation des adresses postales (RGPD), le délai de fabrication, et la charge d'expédition en décembre. |
| **R5** | **Calendrier non négociable** | 🟠 Élevé | 8 semaines avant le gel des fonctionnalités, pour un périmètre large et une équipe d'une personne. Le risque n'est pas de livrer en retard : c'est de livrer **instable** le 1ᵉʳ novembre, ce qui serait pire qu'un périmètre réduit. Mitigation : discipline MoSCoW stricte en Phase 2 et livraison par tranches vérifiables. |
| **R6** | **Notifications iOS conditionnées à l'installation** | 🟠 Élevé | Sur iPhone, aucune notification n'est possible si la PWA n'est pas ajoutée à l'écran d'accueil. Les notifications sont pourtant une exigence forte. Si le taux d'installation est faible, la boucle quotidienne se casse pour une partie des participants. Mitigation : onboarding d'installation explicite et repli e-mail systématique. |
| **R7** | **Indisponibilité de Strava pendant le jeu** | 🟡 Moyen | Une panne ou un changement d'API de Strava en novembre gèle le jeu, et la saisie manuelle est exclue. Mitigation : rattrapage automatique des activités après rétablissement, et procédure d'arbitrage manuel par l'administrateur en dernier recours. |
| **R8** | **Communication « 100 % remis en don »** | 🟡 Moyen | Annoncer 100 % alors que Stripe prélève une commission est factuellement inexact et expose à un reproche de pratique commerciale trompeuse. Mitigation : reformuler, ou faire compléter la différence par l'association. |
| **R9** | **Triche et activités aberrantes** | 🟡 Moyen | Une activité peut être créée artificiellement sur Strava (trajet en voiture enregistré en vélo, activité importée). Une triche visible démobilise les honnêtes. Mitigation : contrôles de cohérence automatiques, signalement, et arbitrage manuel par l'administrateur. |
| **R10** | **Production des 50 visuels de cartes** | 🟡 Moyen | Les visuels sont fournis par le PO, générés par IA hors du périmètre projet. Le risque n'est plus la production mais le **délai de mise à disposition** et la **cohérence de la série**. Un retard sur les visuels bloque la fin du développement de l'album. |
| **R11** | **Dépendance à un animateur unique** | 🟡 Moyen | L'animation quotidienne repose sur une équipe bénévole restreinte. Une indisponibilité en novembre casse la boucle d'animation. Mitigation : possibilité de programmer les défis à l'avance sur tout le mois. |
| **R12** | **RGPD sur les données sportives** | 🟡 Moyen | Localisation, rythme cardiaque, données de santé : traitement sensible. Un manquement expose l'association. Mitigation : minimisation dès la conception, consentement explicite, durée de conservation courte, export et suppression de compte. |

### 10.2 Questions ouvertes

- **Q1 — Objectif chiffré.** Quels sont les résultats des 4 éditions précédentes
  (participants, montant collecté) ? Ce sont les seules données réelles disponibles, et
  elles doivent servir de base aux objectifs plutôt qu'une estimation.
- **Q2 — Le don doit-il progresser avec le niveau ?** Assume-t-on que les trois niveaux
  reversent 12 €, ou indexe-t-on une part du don sur le prix payé ?
- **Q3 — Destination du revenu des packs.** Les achats en cours de jeu sont-ils reversés
  intégralement, ou financent-ils d'abord les coûts (médailles, infrastructure) ?
- **Q4 — Coût réel de la médaille.** Un fournisseur est-il identifié ? Quel prix
  unitaire, à quel volume, et avec quel délai de fabrication ?
- **Q5 — Engagement de volume sur les médailles.** Faut-il commander avant de connaître
  le nombre exact d'inscrits de niveau 2 et 3 ? Si oui, qui porte le risque de stock ?
- **Q6 — Composition des équipes.** Qui peut créer une équipe ? Y a-t-il une taille
  minimale ou maximale ? Le classement par équipe est-il au total ou à la moyenne — un
  total favorise mécaniquement les grosses équipes.
- **Q7 — Remboursements.** Quelle politique en cas de blessure, d'abandon ou d'erreur de
  niveau ? Cela conditionne les CGV et le suivi comptable.
- **Q8 — Participants sans Strava.** Que fait-on de quelqu'un qui paye puis découvre
  qu'il n'a pas Strava et ne veut pas en créer ? Remboursement, ou accompagnement ?
- **Q9 — Formule entreprise.** Une entreprise qui inscrit 20 personnes paye-t-elle
  20 inscriptions individuelles, ou faut-il une facturation groupée ? Cela change le
  parcours de paiement.
- **Q10 — Ouverture des inscriptions en cours de jeu.** Peut-on encore s'inscrire après
  le 1ᵉʳ novembre ? Si oui, avec quel rattrapage sur les défis déjà passés ?

### 10.3 Sujets nécessitant une investigation

1. **Contrat développeur Strava** — lecture intégrale des conditions, en particulier sur
   les classements, l'affichage inter-athlètes et l'usage commercial ou associatif.
   **À faire cette semaine.**
2. **Procédure et délai de relèvement du quota Strava** — comment la demande se formule,
   quels justificatifs, quel délai constaté. **À faire cette semaine.**
3. **Récupération des activités : webhooks ou interrogation périodique** — fiabilité,
   quotas, comportement en cas de panne.
4. **Vérification d'identité Stripe pour une association loi 1901** — pièces exigées et
   délai réel. **À faire cette semaine.**
5. **Notifications Web Push sur iOS** — versions minimales, comportement réel après
   installation, taux de refus observés.
6. **Fournisseurs de médailles** — prix unitaire par palier de volume, délai de
   fabrication, coût d'expédition en France.
7. **Résultats des éditions 1 à 4** — participants, collecte, points de friction relevés.
8. **Détection d'activités aberrantes** — quels contrôles simples sont réellement
   efficaces sans devenir intrusifs.

---

## 11. Annexes

### A. Synthèse de la recherche

Aucune étude de marché formelle n'a été conduite à ce stade. Les éléments de comparaison
figurant en section 2.2 reposent sur la connaissance qu'a le PO de son marché et sur
l'expérience de quatre éditions précédentes. Une analyse concurrentielle structurée
(`create-competitor-analysis`) est disponible dans BMAD si le PO la juge nécessaire —
elle n'apparaît pas indispensable au regard du calendrier.

### B. Apport des parties prenantes

| Source | Apport |
| --- | --- |
| Sylvain, PO | Vision produit, périmètre fonctionnel, contraintes techniques et business, structure tarifaire des 3 niveaux, orientation équipes |
| Table Ronde Française | 4 éditions d'antériorité, base de participants existante, structure juridique d'encaissement |
| Fondation Movember | Accord de principe obtenu, sans usage de la marque |

### C. Références

- Dépôt du projet : `https://github.com/LeBuffle/Movember`
- Conventions de travail : [`CLAUDE.md`](../CLAUDE.md)
- À constituer : contrat développeur Strava, grille tarifaire Stripe, bilans des
  éditions 1 à 4

---

## 12. Prochaines étapes

### 12.1 Actions immédiates

1. **Créer l'application développeur Strava et engager la demande de relèvement de
   quota.** Risques R1 et R2 — action la plus urgente du projet, sur le chemin critique
   et hors de notre contrôle.
2. **Lire le contrat développeur Strava** et confirmer que les classements entre
   participants sont autorisés. Si ce n'est pas le cas, le concept doit être ajusté
   maintenant, pas en octobre.
3. **Ouvrir le compte Stripe de l'association** et lancer la vérification d'identité.
   Risque R3.
4. **Récupérer les chiffres des éditions 1 à 4** pour fixer des objectifs réels
   (question Q1).
5. **Consulter des fournisseurs de médailles** pour obtenir un prix unitaire ferme
   (risque R4, questions Q4 et Q5).
6. **Valider ce Brief**, puis lancer la Phase 2 (PRD).

### 12.2 Passation au PM

Ce Project Brief fournit le contexte complet du projet DEFI Movember. Le PM doit
démarrer en mode génération de PRD, relire ce brief intégralement, et construire le PRD
section par section avec le PO.

**Points d'attention prioritaires pour le PM :**

- Appliquer une **priorisation MoSCoW sévère** : 8 semaines, une personne, et une date
  intangible. Tout ce qui peut attendre le 2 novembre doit attendre.
- Couvrir les **trois parcours** : participant, administrateur/animateur, visiteur
  public.
- Trancher les **questions Q2, Q3, Q6, Q7, Q9 et Q10** avec le PO : elles ont un impact
  direct sur le périmètre fonctionnel.
- Traiter les **notifications comme une exigence de premier rang**, avec le parcours
  d'installation iOS et le repli e-mail dans le périmètre du MVP.
- Confirmer que **Garmin reste hors MVP**.
- Spécifier le back-office comme un **produit à part entière**, utilisable par un
  bénévole non technique depuis un téléphone — c'est la promesse centrale de cette
  refonte.
