import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildJoinCode,
  CODE_LENGTH,
  formatJoinCode,
  normaliseJoinCode,
  slugify,
} from "@/lib/teams/code";

/* =========================================================================
 * Les équipes (story 7.1)
 *
 * Le principal levier de croissance de cette édition : une équipe permet
 * d'embarquer un club ou une entreprise d'un bloc plutôt qu'une personne à la
 * fois. Tout ce qui complique l'adhésion est du recrutement perdu.
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

const migration = code(read("supabase/migrations/20260806200000_teams.sql"));
const membership = code(read("src/lib/teams/membership.ts"));
const page = code(read("src/app/(participant)/jeu/equipe/page.tsx"));

describe("le code d'adhésion", () => {
  it("évite les caractères qu'on confond à voix haute", () => {
    // AC 3. Un code qu'on épelle mal est un participant qui ne rejoint pas.
    const generated = buildJoinCode(
      Array.from({ length: CODE_LENGTH }, (_, index) => index / CODE_LENGTH),
    );

    expect(generated).not.toMatch(/[OIL01]/);
  });

  it("fait toujours huit caractères", () => {
    expect(buildJoinCode([0, 0, 0, 0, 0, 0, 0, 0])).toHaveLength(CODE_LENGTH);
    expect(buildJoinCode([])).toHaveLength(CODE_LENGTH);
  });

  it("ne déborde pas de son alphabet, même sur une valeur limite", () => {
    const generated = buildJoinCode(Array(CODE_LENGTH).fill(1));

    expect(generated).toHaveLength(CODE_LENGTH);
    expect(generated).not.toMatch(/undefined/);
  });

  it("se lit en deux groupes de quatre", () => {
    expect(formatJoinCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });

  it("pardonne la casse, les espaces et les tirets", () => {
    // Ce que tout le monde tape de travers, et pour quoi personne ne doit
    // être puni.
    expect(normaliseJoinCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normaliseJoinCode(" ABCD EFGH ")).toBe("ABCDEFGH");
  });

  it("refuse ce qui n'est pas un code plutôt que de chercher un fragment", () => {
    // AC 5 : un code inconnu reçoit une phrase, jamais une erreur.
    expect(normaliseJoinCode("ABC")).toBeNull();
    expect(normaliseJoinCode("")).toBeNull();
    expect(normaliseJoinCode("ABCDEFGHIJ")).toBeNull();
  });
});

describe("le slug", () => {
  it("replie les accents au lieu de les jeter", () => {
    expect(slugify("Équipe Café")).toBe("equipe-cafe");
  });

  it("refuse un nom dont il ne reste rien", () => {
    expect(slugify("!!!")).toBeNull();
    expect(slugify("")).toBeNull();
  });

  it("ne laisse pas de tiret en fin de chaîne", () => {
    expect(slugify("Les Moustachus !")).toBe("les-moustachus");
  });
});

describe("une seule équipe par participant", () => {
  it("la garde est un index unique, pas une vérification dans le code", () => {
    // AC 2. Sans elle, quelqu'un dans trois équipes compterait trois fois et
    // le classement d'équipe serait une absurdité arithmétique.
    expect(migration).toMatch(
      /create unique index team_members_one_team_per_edition/,
    );
    expect(migration).toMatch(/\(profile_id, edition_id\)/);
  });

  it("l'adhésion lit le refus de la base plutôt que de vérifier avant", () => {
    expect(membership).toMatch(/error\.code === "23505"/);
  });

  it("distingue « déjà dans cette équipe » de « déjà dans une autre »", () => {
    // AC 4 : rejoindre deux fois la même équipe ne crée pas de doublon, et ne
    // se lit pas comme un refus.
    expect(membership).toMatch(/alreadyMember: true/);
    expect(membership).toMatch(/reason: "already-in-team"/);
  });
});

describe("le code d'adhésion est un secret", () => {
  it("la table des équipes n'est lisible que par son capitaine", () => {
    // La sécurité filtre des LIGNES, pas des COLONNES : ouvrir la table pour
    // afficher les noms d'équipe distribuerait tous les codes.
    expect(migration).toMatch(
      /create policy "captains read their own team"[\s\S]*?auth\.uid\(\)\) = captain_id/,
    );
  });

  it("une vue expose les équipes sans leur code", () => {
    expect(migration).toMatch(/create view public\.public_teams/);

    const view = migration.slice(
      migration.indexOf("create view public.public_teams"),
      migration.indexOf("comment on view"),
    );

    expect(view).not.toMatch(/join_code/);
  });

  it("et le code ne remonte qu'au capitaine", () => {
    expect(membership).toMatch(/joinCode: isCaptain \? team\.join_code : null/);
  });

  it("l'écran ne l'affiche qu'au capitaine", () => {
    expect(page).toMatch(/team\.isCaptain && team\.joinCode/);
  });
});

describe("les écritures", () => {
  it("n'ont aucune politique, et c'est le point", () => {
    // La sécurité peut vérifier « cette ligne est la vôtre », pas « vous
    // connaissiez le code ». Une politique d'insertion laisserait entrer
    // n'importe qui dans n'importe quelle équipe par identifiant.
    expect(migration).not.toMatch(/for insert/i);
    expect(migration).not.toMatch(/for update/i);
    expect(migration).not.toMatch(/for delete/i);
    expect(migration).not.toMatch(/for all/i);
  });

  it("passent par le serveur, avec l'identité prise dans la session", () => {
    expect(membership).toMatch(/createAdminClient/);
    expect(membership).toMatch(/async function sessionProfile/);
    expect(membership).toMatch(/return user\?\.id \?\? null/);
  });

  it("activent la sécurité au niveau des lignes sur les deux tables", () => {
    expect(migration).toMatch(
      /alter table public\.teams enable row level security/,
    );
    expect(migration).toMatch(
      /alter table public\.team_members enable row level security/,
    );
  });
});

describe("créer une équipe", () => {
  it("rend son créateur capitaine dans le même geste", () => {
    // Une équipe sans capitaine est une équipe que l'organisation devra
    // adopter à la main, en novembre.
    expect(membership).toMatch(/role: "capitaine"/);
  });

  it("nettoie derrière elle si le capitaine n'a pas pu être enregistré", () => {
    // Une équipe vide dans toutes les listes est pire qu'une création ratée
    // qu'on peut simplement recommencer.
    const region = membership.slice(
      membership.indexOf("if (memberError)"),
      membership.indexOf("return { ok: true, teamId: team.id }"),
    );

    expect(region).toMatch(/\.from\("teams"\)\s*\.delete\(\)/);
  });

  it("laisse la base trancher sur les noms en double", () => {
    // Deux personnes créant « Les Moustachus » à la même seconde passent
    // toutes les deux une vérification préalable ; une seule passe l'index.
    expect(migration).toMatch(/create unique index teams_name_unique/);
    expect(migration).toMatch(/lower\(name\)/);
  });
});
