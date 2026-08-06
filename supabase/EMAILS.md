# Modèles d'e-mails — à configurer dans Supabase

Les e-mails d'authentification sont envoyés par Supabase, avec des textes **en anglais par
défaut**. Ils se remplacent dans l'interface, pas dans le code : c'est donc une manipulation
à faire une fois, à la main.

**Supabase → Authentication → Emails**

---

## 1. Confirm signup — confirmation d'inscription

**Objet :**

```
Confirmez votre adresse — DEFI Movember
```

**Corps :**

```html
<h2>Bienvenue dans le DEFI Movember</h2>

<p>Il ne reste qu'une étape : confirmer votre adresse e-mail.</p>

<p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse</a></p>

<p>Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.</p>

<hr>
<p style="color:#525252;font-size:13px">
  DEFI Movember — projet indépendant porté par une association loi 1901.
  Ce n'est pas l'application officielle de la fondation Movember.
</p>
```

---

## 2. Reset password — réinitialisation

**Objet :**

```
Réinitialiser votre mot de passe — DEFI Movember
```

**Corps :**

```html
<h2>Nouveau mot de passe</h2>

<p>Vous avez demandé à réinitialiser votre mot de passe.</p>

<p><a href="{{ .ConfirmationURL }}">Choisir un nouveau mot de passe</a></p>

<p>Ce lien expire dans une heure.</p>

<p>
  Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.
</p>

<hr>
<p style="color:#525252;font-size:13px">
  DEFI Movember — projet indépendant porté par une association loi 1901.
</p>
```

---

## 3. Magic link et Change email

Non utilisés par l'application à ce stade. À traduire si le parcours évolue.

---

## Réglages à vérifier au passage

**Authentication → URL Configuration**

| Réglage | Valeur |
| --- | --- |
| Site URL | `https://staging.defi-movember.fr` *(puis le domaine de production en octobre)* |
| Redirect URLs | `https://staging.defi-movember.fr/**` et `https://defi-movember.fr/**` |

> Sans ces adresses déclarées, Supabase refuse la redirection après confirmation et le
> participant se retrouve sur une page d'erreur. C'est la cause la plus fréquente d'un
> lien de confirmation qui « ne marche pas ».

**Authentication → Providers → Email**

- « Confirm email » **activé** : une adresse non vérifiée ne doit pas pouvoir jouer, car
  c'est par elle que passent les rappels de secours si la personne n'installe pas
  l'application.

---

## Le jour du lancement — l'envoi d'e-mails

Supabase limite fortement le nombre d'e-mails envoyés par son service intégré : il est
prévu pour du développement, **pas pour 600 inscriptions en quelques jours**.

> ⚠️ **C'est un bloquant d'ouverture, pas un confort.** Aucun compte ne peut être créé
> sans son e-mail de confirmation. La limite est atteinte après quelques envois **par
> heure** — constatée en préproduction le 6 août avec moins de dix essais. Le jour où les
> inscriptions ouvrent, la dixième personne de la journée ne peut plus créer de compte, et
> le symptôme qu'elle voit est « le site ne marche pas ».
>
> Pour continuer à tester en attendant, sur la **préproduction uniquement** :
> **Authentication → Providers → Email → Confirm email → désactiver**. Les comptes se
> créent alors sans e-mail. **À réactiver avant la production** — sans confirmation,
> n'importe qui peut créer un compte avec l'adresse de quelqu'un d'autre.

Il faudra donc, **avant l'ouverture des inscriptions**, brancher Supabase sur un service
d'envoi réel — Resend est prévu par l'architecture — dans
**Authentication → Emails → SMTP Settings**.

C'est un point à traiter avec l'epic 6 (notifications), qui met déjà en place ce service
pour le repli des notifications push. Les deux usages partageront le même domaine
d'expédition authentifié.
