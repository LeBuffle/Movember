# Epic 6 — Notifications et installation PWA

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | fin septembre 2026 |
| **Dépendances** | Epic 1 (story 1.8) · Epic 4 · Epic 5 |
| **Stories** | 8 |

---

## Objectif

Garantir que chaque participant est prévenu chaque jour de son défi et de ses résultats,
par notification push s'il a installé l'application, par e-mail sinon.

## Valeur livrée

**C'est ce qui fait revenir les participants.** Une application de jeu quotidien sans
rappel quotidien perd ses joueurs en une semaine. C'est une exigence forte et non
négociable du PO.

## La contrainte structurante

**Sur iPhone, les notifications web ne fonctionnent que si la PWA a été ajoutée à l'écran
d'accueil.** L'installation n'est donc pas une option proposée en passant : c'est une
**étape du parcours d'inscription**, avec des instructions détectées selon l'appareil, et
un rappel pour ceux qui l'ont sautée.

## Décisions applicables

- **D6 (architecture)** — Web Push natif avec clés VAPID, sans service tiers payant. Repli
  e-mail **limité aux notifications essentielles** : défi du jour, annonces, relances. Les
  validations et les cartes restent dans l'application.
- Une notification groupée lorsque plusieurs défis sont validés simultanément — trois
  notifications successives seraient perçues comme du bruit.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 6.1 | Service worker et abonnement aux notifications push | M |
| 6.2 | Parcours d'installation guidé, distinct iPhone et Android | M |
| 6.3 | Envoi de notifications push par lots | M |
| 6.4 | Repli e-mail pour les participants sans push | M |
| 6.5 | Notification du défi du jour | M |
| 6.6 | Notification de validation et d'obtention de carte, groupée | M |
| 6.7 | Préférences de notification par catégorie | M |
| 6.8 | Envoi manuel d'une notification ciblée depuis le back-office | M |

## Critères de sortie

- [ ] Un participant qui installe la PWA sur iPhone reçoit une notification push.
- [ ] Un participant qui n'installe pas reçoit l'e-mail équivalent pour les notifications
      essentielles.
- [ ] Le parcours d'installation affiche les bonnes instructions selon l'appareil détecté.
- [ ] Trois défis validés simultanément produisent **une seule** notification.
- [ ] Un envoi à 800 destinataires aboutit sans blocage ni perte.
- [ ] Un point de terminaison définitivement en échec est désactivé automatiquement.
- [ ] Le participant peut désactiver chaque catégorie indépendamment.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Taux d'installation insuffisant sur iPhone | Installation intégrée au parcours d'inscription, rappel aux non-installés, repli e-mail systématique |
| E-mails classés en indésirable | Domaine d'expédition authentifié SPF/DKIM, **à préparer dès septembre** — pas la veille du lancement |
| Volume d'e-mails supérieur au quota gratuit | Repli restreint aux notifications essentielles ; offre payante budgétée si nécessaire |
