import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  formatValue,
  isCategory,
} from "@/lib/leaderboards/categories";
import { explainNormalisation } from "@/lib/leaderboards/teams";

/* =========================================================================
 * Les écrans de classement (stories 7.4 à 7.7 et 7.9)
 *
 * À 600 participants, un classement unique n'intéresse que les dix premiers.
 * Sept catégories donnent à chacun un endroit où figurer honorablement — et
 * « vous êtes 143ᵉ » est ce qui donne une raison de sortir demain à quelqu'un
 * qui ne sera jamais premier.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const board = code(read("src/app/(participant)/jeu/classement/page.tsx"));
const dashboard = code(
  read("src/app/(participant)/jeu/tableau-de-bord/page.tsx"),
);
const readLib = code(read("src/lib/leaderboards/read.ts"));
const teamsLib = code(read("src/lib/leaderboards/teams.ts"));
const collective = code(read("src/lib/leaderboards/collective.ts"));
const home = code(read("src/app/page.tsx"));
const teamPage = code(read("src/app/(participant)/jeu/equipe/[slug]/page.tsx"));

describe("les sept classements individuels", () => {
  it("existent tous", () => {
    // AC 1, 2 de la story 7.4.
    expect(CATEGORIES.map((entry) => entry.key)).toEqual([
      "points",
      "challenges",
      "cards",
      "run",
      "bike",
      "activities",
      "duration",
    ]);
  });

  it("refusent une catégorie inventée plutôt que de casser la page", () => {
    expect(isCategory("points")).toBe(true);
    expect(isCategory("le-plus-moustachu")).toBe(false);
  });

  it("disent que le classement des cartes ignore les packs", () => {
    // AC 5.
    const cards = CATEGORIES.find((entry) => entry.key === "cards")!;

    expect(cards.description).toMatch(/packs n’y figurent jamais/);
  });

  it("s'affichent en unités humaines", () => {
    // Personne ne dit « j'ai fait 12 400 mètres ».
    expect(formatValue(12400, "metres")).toMatch(/12,4 km/);
    expect(formatValue(7200, "seconds")).toMatch(/2 h/);
    expect(formatValue(1800, "seconds")).toMatch(/30 min/);
  });
});

describe("ma position est toujours visible", () => {
  it("elle est lue séparément du haut de tableau", () => {
    // AC 3. C'est toute la raison d'être de cette requête : les quatre cents
    // personnes qui ne sont pas dans les cinquante premières.
    expect(readLib).toMatch(/own: LeaderboardRow \| null/);
    expect(readLib).toMatch(/\.eq\("profile_id", self\)/);
  });

  it("et l'écran ne la répète pas quand elle est déjà dans la liste", () => {
    expect(board).toMatch(
      /board\.own && !board\.rows\.some\(\(row\) => row\.isSelf\)/,
    );
  });
});

describe("les participants sont désignés par leur pseudonyme", () => {
  it("lus par la vue publique, jamais par la table des profils", () => {
    // AC 4. Lire `profiles` pour un nom livrerait les adresses e-mail dans la
    // même requête.
    expect(readLib).toMatch(/from\("public_profiles"\)/);
    expect(readLib).not.toMatch(/from\("profiles"\)/);
  });

  it("et aucune adresse n'apparaît nulle part", () => {
    expect(readLib).not.toMatch(/email/i);
    expect(board).not.toMatch(/email/i);
  });
});

describe("rien n'est calculé à l'affichage", () => {
  it("tout vient de la vue matérialisée", () => {
    expect(readLib).toMatch(/from\("leaderboard_entries"\)/);
    expect(readLib).not.toMatch(/from\("challenge_assignments"\)/);
    expect(readLib).not.toMatch(/from\("card_grants"\)/);
    expect(readLib).not.toMatch(/from\("activities"\)/);
  });

  it("et la date du calcul est affichée", () => {
    // AC 6 de la story 7.6 : pour que personne ne prenne un décalage de
    // quinze minutes pour une erreur.
    expect(board).toMatch(/computedAt/);
    expect(dashboard).toMatch(/computedAt/);
  });
});

describe("le classement d'équipe est normalisé", () => {
  it("par le nombre de membres, avec un exposant réglable", () => {
    // AC 2 et 4 de la story 7.5.
    expect(teamsLib).toMatch(/Math\.pow\(totals\.members, exponent\)/);
    expect(teamsLib).toMatch(/from\("leaderboard_settings"\)/);
  });

  it("et la règle est expliquée en français", () => {
    // AC 3. Le risque de cette story est social : une normalisation perçue
    // comme injuste vaut pire qu'une absence de classement d'équipe.
    const sentence = explainNormalisation(0.5);

    expect(sentence).toMatch(/deux fois plus grande/);
    expect(sentence).toMatch(/1,4 fois plus de points/);
    expect(board).toMatch(/explainNormalisation/);
  });

  it("la phrase suit l'exposant au lieu d'être écrite en dur", () => {
    // Sans quoi elle deviendrait fausse le jour où le PO ajuste le nombre.
    expect(explainNormalisation(0)).toMatch(/sans correction/);
    expect(explainNormalisation(1)).toMatch(/moyenne/);
  });

  it("garde le total brut visible à côté du score", () => {
    // AC 6 : c'est le chiffre dont une entreprise est fière.
    expect(board).toMatch(/\{row\.points\}/);
    expect(board).toMatch(/au total/);
  });

  it("n'affiche pas une équipe trop petite", () => {
    // AC 5. Une équipe d'une personne est un classement individuel déguisé.
    expect(teamsLib).toMatch(/totals\.members >= minMembers/);
  });

  it("et une égalité partage une place", () => {
    expect(teamsLib).toMatch(/team\.score !== previous/);
  });
});

describe("les compteurs collectifs", () => {
  it("sont lisibles sans compte", () => {
    // AC 2 de la story 7.7.
    expect(collective).toMatch(/createAnonClient/);
    expect(collective).not.toMatch(/supabase\/server/);
    expect(collective).not.toMatch(/getUser/);
  });

  it("ne révèlent aucune donnée individuelle", () => {
    // AC 3. Des sommes, et rien que des sommes.
    expect(collective).not.toMatch(/display_name/);
    expect(collective).not.toMatch(/public_profiles/);
    expect(collective).not.toMatch(/profile_id/);
  });

  it("annoncent le montant réellement encaissé", () => {
    // AC 6. Une ligne de remboursement porte un montant POSITIF et se
    // soustrait (story 2.6) : une seconde implémentation ici finirait par
    // diverger, et la page publique annoncerait de l'argent que
    // l'association n'a plus.
    expect(collective).toMatch(/summarisePayments/);
    expect(collective).toMatch(/grossCents - money\.refundedCents/);
  });

  it("distinguent « à zéro » de « illisible »", () => {
    // AC 5 : des compteurs à zéro sont un début, pas une panne.
    expect(collective).toMatch(/available: boolean/);
    expect(collective).toMatch(/available: false/);
  });

  it("et la page d'accueil les affiche", () => {
    expect(home).toMatch(/collectiveTotals/);
    expect(home).toMatch(/<CollectiveFigures live=\{live\} \/>/);
  });
});

describe("la page d'équipe", () => {
  it("nomme les membres par leur pseudonyme", () => {
    // AC 2 de la story 7.9.
    expect(teamPage).toMatch(/teamMembers/);
    expect(teamPage).not.toMatch(/email/i);
  });

  it("ne montre le code d'invitation qu'au capitaine de cette équipe", () => {
    // AC 4.
    expect(teamPage).toMatch(/isOwnTeam && own\?\.isCaptain && own\.joinCode/);
  });

  it("lit l'équipe par la vue publique, qui ne porte aucun code", () => {
    expect(teamPage).toMatch(/from\("public_teams"\)/);
    expect(teamPage).not.toMatch(/from\("teams"\)/);
  });

  it("dit quelque chose quand l'équipe vient d'être créée", () => {
    // AC 5.
    expect(teamPage).toMatch(/Personne n’a encore rejoint/);
  });

  it("et le classement d'équipe y mène", () => {
    // AC 3.
    expect(board).toMatch(/\/jeu\/equipe\/\$\{row\.slug\}/);
  });
});

describe("un classement vide se dit", () => {
  it("plutôt que d'afficher une page blanche", () => {
    // AC 6 de la story 7.4, AC 4 de la story 7.6.
    expect(board).toMatch(/Le classement est encore vide/);
    expect(dashboard).toMatch(/Vos chiffres arrivent/);
  });
});
