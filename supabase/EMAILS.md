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

## L'envoi d'e-mails — fait ✅

**Branché le 8 août.** Le service intégré de Supabase n'est plus utilisé : les e-mails
d'authentification partent par Resend, depuis `bonjour@defi-movember.fr`.

La marche à suivre complète — et ce qu'il faudra refaire pour la production — est dans
[`docs/resend.md`](../docs/resend.md).

> **Pourquoi c'était un bloquant d'ouverture.** Le service intégré est limité à quelques
> envois par heure ; la limite avait été atteinte en préproduction le 6 août avec moins de
> dix essais. Sans service d'envoi réel, la dixième personne à s'inscrire un jour
> d'ouverture n'aurait pas pu créer de compte — et le symptôme qu'elle aurait vu est « le
> site ne marche pas ».

**Deux limites restent à régler avant l'ouverture**, et elles ne sont pas au même endroit :

| Limite | Où | Pourquoi elle compte |
| --- | --- | --- |
| **Supabase** | Authentication → Rate Limits | Basse par défaut, indépendante de Resend. C'est elle qui bloquerait le premier jour d'inscriptions. |
| **Resend** | Resend → Usage | 100 e-mails par jour sur le palier gratuit. Le calcul est dans `docs/resend.md`. |
