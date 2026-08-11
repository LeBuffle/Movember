# Resend — brancher l'envoi d'e-mails

> **C'est le dernier bloquant d'ouverture.** Sans lui, aucun compte ne peut être créé
> au-delà de quelques-uns par heure : le service intégré de Supabase est prévu pour du
> développement, pas pour plusieurs centaines d'inscriptions en deux semaines.

---

## ⚠️ La clé API ne se colle nulle part dans une conversation

Elle donne le droit d'envoyer des e-mails **au nom du domaine**. Quelqu'un qui l'obtient
peut écrire à n'importe qui en se faisant passer pour l'association.

Elle se colle à **deux endroits, et deux seulement** :

1. Dans les fichiers d'environnement sur le VPS (`deploy/.env.staging`, puis
   `deploy/.env.production`), en `chmod 600`.
2. Dans le champ mot de passe du réglage SMTP de Supabase.

Jamais dans le dépôt, jamais dans un e-mail, jamais dans un message.

Si elle a déjà circulé quelque part : **Resend → API Keys → la supprimer et en créer une
nouvelle.** C'est gratuit et immédiat.

---

## Deux usages, un seul compte

Resend sert à deux choses dans ce projet, et il est important de ne pas les confondre —
elles se configurent à des endroits différents :

| Usage | Ce que ça envoie | Où ça se configure |
| --- | --- | --- |
| **Supabase Auth** | Confirmation d'inscription, mot de passe oublié | Tableau de bord Supabase → SMTP |
| **L'application** | E-mail de bienvenue après paiement, rappels quotidiens pour qui n'a pas installé l'app | `deploy/.env.*` sur le VPS |

Le premier est le bloquant d'ouverture. Le second peut attendre quelques jours.

---

## Étape 1 — Vérifier le domaine (la seule étape vraiment obligatoire)

**Un compte Resend neuf ne peut écrire qu'à vous-même.** Tant que le domaine n'est pas
vérifié, tout envoi vers une autre adresse est refusé. C'est la cause numéro un des
« ça marchait dans mes tests et pas en vrai ».

**Resend → Domains → Add Domain → `defi-movember.fr`**

Resend affiche alors trois ou quatre enregistrements DNS à créer chez le registrar du
domaine :

| Type | À quoi ça sert |
| --- | --- |
| `TXT` (DKIM) | Signe les messages. Sans lui, Gmail met tout en indésirable. |
| `MX` + `TXT` (SPF) | Autorise Resend à écrire au nom du domaine. |
| `TXT` (DMARC) | Dit aux fournisseurs quoi faire d'un message non signé. Facultatif chez Resend, **à mettre quand même**. |

Copier-coller chaque ligne chez le registrar, puis **Verify** dans Resend. La propagation
prend de quelques minutes à quelques heures.

> ⚠️ **Attention à l'enregistrement MX.** Si `defi-movember.fr` reçoit déjà du courrier
> (une boîte chez le registrar, par exemple), l'ajout d'un MX peut détourner la réception.
> Resend propose un sous-domaine d'envoi pour éviter ça — par exemple `send.defi-movember.fr`
> ou `mail.defi-movember.fr`. **C'est ce que je recommande** : le domaine principal garde sa
> messagerie, et une éventuelle mauvaise réputation d'envoi ne contamine pas l'adresse de
> contact de l'association.

**Adresse d'expédition retenue :** `DEFI Movember <bonjour@send.defi-movember.fr>`
(à adapter au sous-domaine réellement vérifié).

Le nom affiché compte : un message de `bonjour@…` sans nom s'ouvre moins qu'un message de
« DEFI Movember ».

---

## Étape 2 — Brancher Supabase (le bloquant)

**Supabase → Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**

| Champ | Valeur |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` — littéralement ce mot, ce n'est pas une erreur |
| Password | **la clé API Resend** |
| Sender email | `bonjour@send.defi-movember.fr` |
| Sender name | `DEFI Movember` |

Puis **Save**.

Deux réglages à vérifier au passage, dans **Authentication → Providers → Email** :

- **Confirm email : activé.** Si tu l'avais désactivé pour tester, c'est le moment de le
  remettre. Sans confirmation, n'importe qui peut créer un compte avec l'adresse de
  quelqu'un d'autre.
- Les modèles d'e-mails en français : ils sont dans `supabase/EMAILS.md`, à coller dans
  **Authentication → Emails**.

**Vérifier tout de suite :** créer un compte de test avec une adresse que tu contrôles, et
regarder l'e-mail arriver. Il doit venir de `bonjour@send.defi-movember.fr`, pas de
`noreply@mail.app.supabase.io`.

---

## Étape 3 — Brancher l'application

Sur le VPS, dans `deploy/.env.staging` (puis `deploy/.env.production` en octobre) :

```bash
# Sur le serveur, jamais ailleurs
nano /opt/defi-movember/deploy/.env.staging
```

Deux lignes à renseigner :

```
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=DEFI Movember <bonjour@send.defi-movember.fr>
```

Puis :

```bash
chmod 600 /opt/defi-movember/deploy/.env.staging
```

Et redéployer, ou redémarrer le conteneur.

**Tant que ces deux variables sont absentes, l'application n'envoie rien et le dit dans ses
journaux — sans jamais tomber en panne.** C'est l'état actuel, et c'est volontaire : un
service d'envoi manquant ne doit pas empêcher quelqu'un de s'inscrire ou de jouer.

---

## Étape 4 — Vérifier

Dans l'ordre, sur la préproduction :

- [ ] **Créer un compte** avec une adresse réelle. L'e-mail de confirmation arrive, en
      français, et vient bien du domaine vérifié.
- [ ] **Demander un mot de passe oublié.** Même vérification.
- [ ] **Payer une inscription de test.** L'e-mail de bienvenue arrive : niveau, montant
      payé, montant reversé, la mention « ce n'est pas un don défiscalisable », et la
      prochaine étape (relier Strava).
- [ ] **Rejouer l'événement Stripe** depuis leur tableau de bord. **Un seul e-mail de
      bienvenue**, pas deux.
- [ ] Dans **Resend → Logs**, les envois apparaissent avec leur statut. C'est là qu'on
      regarde quand quelqu'un dit « je n'ai rien reçu ».

---

## Ce qu'il faut savoir avant l'ouverture

**Le quota gratuit de Resend est de 3 000 e-mails par mois et 100 par jour.** Faire le
calcul avant novembre :

| Envoi | Volume estimé |
| --- | --- |
| Confirmation d'inscription | 1 par participant, ~600 sur deux semaines |
| Mot de passe oublié | quelques dizaines |
| E-mail de bienvenue | 1 par inscription payée |
| **Rappel quotidien** pour qui n'a pas installé l'application | **1 par jour et par personne concernée** |

Les trois premiers tiennent largement. **Le quatrième est celui qui déborde** : si
200 personnes ne posent pas l'application sur leur écran d'accueil, c'est 200 e-mails par
jour, soit 6 000 sur le mois — deux fois le quota gratuit, et quatre fois la limite
journalière.

Deux réponses, à trancher en octobre :

1. **Passer au palier payant** de Resend (une vingtaine d'euros par mois, sur deux mois).
2. **Pousser fort l'installation de l'application** pendant les inscriptions — l'écran
   d'aide existe déjà, et chaque installation est un e-mail quotidien en moins.

> La deuxième est gratuite et meilleure pour le jeu : une notification push arrive le
> matin, un e-mail se perd dans une boîte. Mais elle ne se décrète pas — d'où la première
> en filet.

**⚠️ La limite de 100 par jour concerne aussi l'ouverture des inscriptions.** Si 150
personnes s'inscrivent le premier jour, les 50 dernières n'ont pas leur e-mail de
confirmation — et ne peuvent pas créer leur compte. À surveiller le jour J, ou à anticiper
en passant au palier payant avant l'ouverture.

---

## Si un e-mail n'arrive pas

1. **Resend → Logs.** Le message y est-il ? S'il est marqué `delivered`, il est arrivé —
   probablement dans les indésirables.
2. **Domaine vérifié ?** Resend → Domains. Un domaine qui repasse en `pending` après une
   modification DNS bloque tous les envois.
3. **Quota atteint ?** Resend → Usage.
4. **Pour un e-mail de confirmation** : le problème est peut-être Supabase et pas Resend.
   Supabase → Logs → Auth.
5. **Pour l'e-mail de bienvenue** : les journaux du serveur portent la ligne
   `[bienvenue] …`, qui dit lequel des trois cas s'est produit — non configuré, refusé, ou
   envoyé.
