import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Le pseudonyme est fixé à l'inscription (story 1.13)
 *
 * C'est l'identité publique du participant : sept classements, les pages
 * d'équipe, l'historique. Quelqu'un qui en change au milieu du mois
 * disparaît pour ses coéquipiers, qui cherchent un nom qui n'existe plus.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/--.*$/gm, "");
}

const migration = code(
  read("supabase/migrations/20260806230000_display_name_is_final.sql"),
);
const actions = code(read("src/lib/auth/actions.ts"));
const form = code(read("src/components/auth/account-form.tsx"));
const account = code(read("src/app/(participant)/mon-compte/page.tsx"));
const signUp = code(read("src/app/(public)/inscription/page.tsx"));

describe("la règle est portée par la base", () => {
  it("un déclencheur refuse le changement", () => {
    // La sécurité au niveau des lignes filtre des LIGNES, pas des COLONNES :
    // la politique « un participant met à jour son propre profil » ne peut
    // pas distinguer une préférence d'un pseudonyme. Seul un déclencheur le
    // peut.
    expect(migration).toMatch(/create trigger profiles_display_name_is_final/);
    expect(migration).toMatch(/before update on public\.profiles/);
    expect(migration).toMatch(
      /new\.display_name is distinct from old\.display_name/,
    );
  });

  it("et l'organisation garde le droit de corriger", () => {
    // Un pseudonyme insultant, une faute de frappe le jour de l'inscription :
    // il faut pouvoir réparer, et c'est un geste tracé.
    expect(migration).toMatch(/not public\.is_admin\(\)/);
  });

  it("la fonction est verrouillée sur son chemin de recherche", () => {
    expect(migration).toMatch(/set search_path = ''/);
  });
});

describe("l'application ne propose plus de le changer", () => {
  it("aucune action ne le met à jour", () => {
    expect(actions).not.toMatch(/updateDisplayName/);
    expect(actions).not.toMatch(/\.update\(\{ display_name/);
  });

  it("mais la création de compte le pose toujours", () => {
    // La seule écriture qui subsiste, et c'est celle qui doit subsister.
    const region = actions.slice(
      actions.indexOf("export async function signUp"),
    );

    expect(region).toMatch(/display_name: parsed\.data\.displayName/);
  });

  it("le formulaire de compte ne porte plus que la déconnexion", () => {
    expect(form).not.toMatch(/name="displayName"/);
    expect(form).toMatch(/signOut/);
  });

  it("l'écran l'affiche et dit pourquoi il est figé", () => {
    // Plutôt qu'un champ grisé, qui se lit comme une indisponibilité passagère
    // et invite à revenir chercher le bouton.
    expect(account).toMatch(/display_name/);
    expect(account).toMatch(/ne change plus/);
  });
});

describe("il se choisit à l'inscription", () => {
  it("le formulaire de création de compte le demande", () => {
    expect(signUp).toMatch(/name: "displayName"/);
    expect(signUp).toMatch(/Pseudonyme/);
  });
});
