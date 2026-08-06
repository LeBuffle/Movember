# Base de données — DEFI Movember

| Dossier | Rôle |
| --- | --- |
| `migrations/` | Évolutions du schéma, versionnées et appliquées dans l'ordre |
| `seed.sql` | Données de démonstration — l'édition 2026 |

---

## La règle qui gouverne ce dossier

> **Toute table ajoutée sous `public` doit activer la sécurité au niveau des lignes dans
> la migration qui la crée.**

Ce n'est pas une recommandation : `tests/unit/rls.test.ts` lit ces fichiers et **fait
échouer la construction** si une table est créée sans protection.

Pourquoi cette sévérité : oublier une politique de sécurité ne produit **aucune erreur et
aucun symptôme visible**. Tout fonctionne — jusqu'au jour où un participant lit les
données d'un autre. C'est exactement le type de défaut qu'on ne découvre qu'après coup, et
le projet manipule des données d'activité sportive, des adresses postales et des
paiements.

---

## Appliquer les migrations

### Le plus simple — par l'interface Supabase

Pour une première mise en place, ou une correction ponctuelle :

1. Ouvrir le projet Supabase → **SQL Editor** → **New query**
2. Copier tout le contenu de `migrations/20260803000000_initial_schema.sql`
3. Cliquer sur **Run**
4. Répéter avec **chaque migration suivante, dans l'ordre du nom de fichier** —
   les noms commencent par une date pour cette raison
5. Répéter avec `seed.sql`

À ce jour, dans l'ordre :

| Fichier | Apporte |
| --- | --- |
| `20260803000000_initial_schema.sql` | `editions`, `profiles`, la vue publique, les règles d'accès |
| `20260804000000_admin_audit_log.sql` | `admin_audit_log` — le journal des actions du back-office |
| `20260804100000_registrations_payments.sql` | `registration_tiers`, `registrations`, `payments` |
| `20260804110000_terms_acceptance.sql` | acceptation des CGV, avec sa version |
| `20260804120000_challenges.sql` | `challenges`, `challenge_assignments` — le catalogue de défis |
| `20260805100000_shipping_addresses.sql` | `shipping_addresses` — où envoyer les contreparties |
| `20260805110000_refunds.sql` | l'identifiant de remboursement, qui le rend non rejouable |
| `20260805120000_challenge_evidence.sql` | ce qui a validé un défi, pour pouvoir le montrer |
| `20260805130000_catchup_assignments.sql` | le défi de rattrapage, quand le catalogue est épuisé |
| `20260805140000_common_challenges.sql` | `common_challenges` — le défi imposé à tous un jour donné |
| `20260805150000_challenge_arbitration.sql` | la marque d'un défi tranché à la main par l'organisation |
| `20260805160000_activities.sql` | `activities` — le format interne unique des activités sportives |
| `20260805170000_activity_consent.sql` | `activity_consents` — le registre inaltérable des autorisations |
| `20260806100000_activity_connections.sql` | `activity_connections` — les comptes sportifs reliés |
| `20260806110000_connection_refresh.sql` | la réservation qui sérialise les rafraîchissements de jeton |
| `20260806120000_activity_minimisation.sql` | l'indicateur « saisie à la main », pour le lot 9 |
| `20260806130000_cards.sql` | `cards`, `card_rarities`, `card_grants` — les cartes et leur attribution |
| `20260806140000_grant_card_with_completion.sql` | la fonction qui valide un défi et donne sa carte en une transaction |

Aucun outil à installer. La contrepartie : c'est manuel, donc à réserver au démarrage.

### Automatisé — par la CLI Supabase

À mettre en place à la story 1.4, quand le déploiement en production appliquera les
migrations tout seul :

```bash
npx supabase link --project-ref <référence-du-projet>
npx supabase db push
```

---

## Ce que contient le schéma initial

**`editions`** — une ligne par édition annuelle. Tout le contenu du jeu s'y rattachera,
pour que l'édition 2027 se lance en insérant des données plutôt qu'en redéveloppant.

**`profiles`** — le profil de jeu, un par compte. Volontairement minimal : moins cette
table contient de données personnelles, moins il y a à protéger. Le **pseudonyme** y
remplace le nom civil, parce que les classements sont publics.

**`admin_audit_log`** — le journal des actions du back-office. Rien n'y écrit encore :
les écrans arrivent avec les lots 4, 5, 6 et 9. La table existe déjà pour que chacun d'eux
la trouve prête plutôt que d'en inventer une.

> **Elle est en écriture seule, et c'est tout l'intérêt.** Aucune règle de modification ni
> de suppression n'existe — pas même pour un administrateur. Un journal que l'on peut
> corriger après coup ne vaut rien le jour où quelqu'un demande pourquoi un défi a été
> annulé ou un participant remboursé. Et la règle d'insertion impose d'écrire **sous son
> propre nom** : il n'y a aucun moyen d'attribuer une action à quelqu'un d'autre.

**`public_profiles`** — une vue exposant **uniquement** l'identifiant, le pseudonyme et
l'avatar.

> Cette vue mérite une explication, parce qu'elle résout un piège réel. La sécurité au
> niveau des lignes filtre des **lignes**, pas des **colonnes**. Autoriser les
> participants à lire les pseudonymes des autres *à travers la table* leur donnerait du
> même coup accès aux adresses e-mail. La vue est donc **le seul moyen autorisé** de lire
> un autre participant, et la table reste strictement privée.

---

## Régénérer les types TypeScript

`src/types/database.ts` est écrit à la main pour l'instant et doit rester en phase avec
les migrations — le compilateur ne peut pas détecter un écart. Une fois la CLI reliée au
projet :

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

---

## Comment devenir administrateur

Le jeu de données ne crée volontairement **aucun compte** : les comptes passent par le
parcours d'inscription, qui déclenche le mécanisme de création de profil. En insérer un
directement produirait un profil que le vrai parcours ne crée jamais, et masquerait un
défaut.

Inscrivez-vous par l'application, puis dans le **SQL Editor** :

```sql
update public.profiles set role = 'admin' where email = 'votre@email.fr';
```

Pour vérifier :

```sql
select display_name, email from public.profiles where role = 'admin';
```

Le back-office s'ouvre ensuite depuis **Mon compte**, ou directement sur `/admin`. Un
compte sans ce rôle reçoit une page « cette page n'existe pas » — le refus ne dit pas ce
qu'il refuse.
