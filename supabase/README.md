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
4. Répéter avec `seed.sql`

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
