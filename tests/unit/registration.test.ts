import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { requiresSession, ROUTES } from "@/lib/auth/routes";
import { TERMS_VERSION } from "@/lib/legal/notices";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

/** Strips comments so prose explaining a rule never counts as breaking it. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const action = stripComments(read("src/lib/registration/actions.ts"));

/* =========================================================================
 * Le parcours entre le choix et le paiement
 *
 * C'est le seul endroit de l'application où une action de participant écrit
 * dans `registrations`, et elle le fait avec la clé de service — celle qui
 * contourne entièrement la sécurité au niveau des lignes. D'où ces tests.
 * ====================================================================== */

describe("l’écriture avec la clé de service reste sûre", () => {
  it("l’identité vient de la session, jamais du formulaire", () => {
    // Rien de ce que soumet le navigateur ne doit pouvoir désigner
    // quelqu'un d'autre.
    expect(action).toMatch(/profile_id:\s*user\.id/);
    expect(action).not.toMatch(/formData\.get\(["']profile/);
    expect(action).not.toMatch(/formData\.get\(["']user/);
  });

  it("le montant vient de la base, jamais du formulaire", () => {
    // Un prix envoyé par le client est un prix choisi par le client.
    expect(action).toMatch(/getTierBySlug\(/);
    expect(action).not.toMatch(/formData\.get\(["'](price|montant|amount)/);
  });

  it("l’inscription est créée « pending », donc sans rien accorder", () => {
    // Ce qui rend cette écriture acceptable : le pire qu'une requête forgée
    // puisse produire est une inscription qui n'a rien payé et ne peut rien.
    expect(action).toMatch(/status:\s*"pending"/);
    expect(action).not.toMatch(/status:\s*"active"/);
  });

  it("vérifie la session avant d’écrire", () => {
    expect(action).toMatch(/getUser\(\)/);
    const sessionCheck = action.indexOf("getUser()");
    const firstWrite = action.indexOf("createAdminClient()");

    expect(sessionCheck).toBeGreaterThan(-1);
    expect(sessionCheck).toBeLessThan(firstWrite);
  });
});

describe("les deux acceptations", () => {
  it("sont exigées toutes les deux", () => {
    // Deux cases distinctes : une case unique « j'accepte les CGV et je
    // reconnais que ce n'est pas un don défiscalisable » se coche sans être
    // lue (FR14, PRD D6).
    expect(action).toMatch(/formData\.get\("cgv"\)/);
    expect(action).toMatch(/formData\.get\("fiscal"\)/);
    expect(action).toMatch(/errors\.cgv/);
    expect(action).toMatch(/errors\.fiscal/);
  });

  it("sont revérifiées côté serveur", () => {
    // Une case à cocher est une indication pour l'utilisateur, pas un
    // contrôle : elle se contourne en deux secondes.
    expect(action).toMatch(/return \{ errors \}/);
  });

  it("sont enregistrées avec la version acceptée", () => {
    // Savoir *quand* quelqu'un a accepté ne dit pas *quoi*. Les CGV vont
    // changer avant l'ouverture des inscriptions.
    expect(action).toMatch(/terms_accepted_at/);
    expect(action).toMatch(/terms_version:\s*TERMS_VERSION/);
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("la base refuse une date sans version", () => {
    const migration = read(
      "supabase/migrations/20260804110000_terms_acceptance.sql",
    );

    expect(migration).toMatch(/check\s*\(/i);
    expect(migration).toMatch(
      /terms_accepted_at is null and terms_version is null/i,
    );
  });

  it("deux cases séparées dans le formulaire, aucune pré-cochée", () => {
    const form = read("src/components/registration/consent-form.tsx");

    expect(form.match(/name="cgv"|name="fiscal"/g)).toHaveLength(2);
    expect(form).not.toMatch(/defaultChecked|checked=\{true\}/);
  });
});

describe("le parcours ne perd pas le niveau choisi", () => {
  it("la page de choix exige une session", () => {
    expect(requiresSession(`${ROUTES.participate}/legendaire`)).toBe(true);
  });

  it("la connexion transmet la destination à l’inscription", () => {
    // Quelqu'un qui a choisi « Sportif légendaire », crée un compte et
    // retombe sur l'accueil recommence — ou renonce.
    expect(read("src/app/(public)/connexion/page.tsx")).toMatch(
      /ROUTES\.signUp\}\?suite=/,
    );
  });

  it("l’inscription transmet la destination jusqu’à l’e-mail de confirmation", () => {
    expect(read("src/app/(public)/inscription/page.tsx")).toMatch(
      /hiddenFields=\{\{ suite/,
    );
    expect(read("src/lib/auth/actions.ts")).toMatch(
      /confirmation\.searchParams\.set\("next", next\)/,
    );
  });

  it("n’accepte qu’une destination interne", () => {
    // Sans ce contrôle, un lien forgé transformerait notre e-mail de
    // confirmation en renvoi vers le site de quelqu'un d'autre.
    expect(read("src/lib/auth/actions.ts")).toMatch(/safeNext\(formData\.get/);
  });
});

describe("un participant déjà inscrit ne paie pas deux fois", () => {
  it("l’action le renvoie vers son espace", () => {
    expect(action).toMatch(/existing\?\.status === "active"/);
    expect(action).toMatch(/redirect\(ROUTES\.account\)/);
  });

  it("une tentative abandonnée est reprise, pas dupliquée", () => {
    expect(action).toMatch(/\.update\(acceptance\)/);
  });
});
