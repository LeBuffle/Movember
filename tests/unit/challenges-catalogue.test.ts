import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CATALOGUE_TARGET } from "@/lib/challenges/catalogue";
import { readChallengeConfig } from "@/lib/challenges/config";
import { EVALUATORS } from "@/lib/challenges/evaluators/registry";

/* =========================================================================
 * Le catalogue de défis de l'édition 2026
 *
 * **Un fichier SQL que le PO éditera lui-même**, en changeant un seuil la
 * veille du lancement. Ce test est ce qui l'empêche d'écrire un défi que
 * personne ne pourra jamais réussir — et le moteur ne s'en plaindrait pas :
 * il refuserait simplement de juger, en silence, une fois par jour et par
 * participant.
 *
 * Il lit le vrai fichier et valide chaque configuration avec le vrai
 * validateur de la story 4.1. Pas une copie, pas un extrait.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");
const source = readFileSync(
  path.join(root, "supabase/challenges-2026.sql"),
  "utf8",
);

type Row = {
  title: string;
  description: string;
  evaluator: string;
  config: Record<string, unknown>;
  sportFamily: string;
  difficulty: string;
  points: number;
  durationScope: string;
  durationDays: number | null;
};

/**
 * Les lignes du fichier, telles qu'elles partiront en base.
 *
 * Le texte français du fichier n'utilise que des apostrophes typographiques
 * (’), jamais l'apostrophe droite — ce qui rend le découpage sûr et évite les
 * doublements d'apostrophe en SQL. Un test le vérifie plus bas, parce que
 * cette convention est aussi ce qui fait tenir ce parseur.
 */
const ROW = new RegExp(
  [
    /\('([^']*)',\s*/, // title
    /'([^']*)',\s*/, // description
    /'(\w+)',\s*/, // evaluator
    /'(\{[\s\S]*?\})',\s*/, // config
    /'(\w+)',\s*/, // sport_family
    /'(\w+)',\s*/, // difficulty
    /(\d+),\s*/, // points
    /'(\w+)',\s*/, // duration_scope
    /(null|\d+)\)/, // duration_days
  ]
    .map((part) => part.source)
    .join(""),
  "g",
);

const rows: Row[] = [...source.matchAll(ROW)].map((match) => ({
  title: match[1]!,
  description: match[2]!,
  evaluator: match[3]!,
  config: JSON.parse(match[4]!) as Record<string, unknown>,
  sportFamily: match[5]!,
  difficulty: match[6]!,
  points: Number(match[7]!),
  durationScope: match[8]!,
  durationDays: match[9] === "null" ? null : Number(match[9]),
}));

describe("le catalogue est lisible tel qu’il partira en base", () => {
  it("contient soixante-dix défis", () => {
    expect(rows).toHaveLength(70);
  });

  it("et il dépasse la cible au-dessus de laquelle la variété commence", () => {
    // Sous ce seuil, tout le monde reçoit les mêmes défis dans un ordre
    // différent, et retirer un seul défi casse le mois.
    expect(rows.length).toBeGreaterThanOrEqual(CATALOGUE_TARGET);
  });

  it("n’utilise que des apostrophes typographiques", () => {
    // Une apostrophe droite dans un littéral SQL doit être doublée. Oubliée
    // une seule fois, elle casse l'import entier — et l'erreur de PostgreSQL
    // ne pointe pas la bonne ligne.
    const body = source.slice(source.indexOf("cross join (values"));
    const rowText = body.slice(0, body.indexOf("\n) as v("));

    for (const line of rowText.split("\n")) {
      // Les commentaires SQL vont jusqu'au bout de la ligne et ne sont pas
      // analysés : une apostrophe y est sans danger.
      if (line.trim().startsWith("--")) continue;

      const quotes = (line.match(/'/g) ?? []).length;
      expect(quotes % 2, `apostrophe non appariée : ${line.trim()}`).toBe(0);
    }
  });
});

describe("chaque défi est jugeable par le moteur", () => {
  it("nomme un évaluateur qui existe", () => {
    for (const row of rows) {
      expect(Object.keys(EVALUATORS), row.title).toContain(row.evaluator);
    }
  });

  it("et sa configuration passe le validateur de la story 4.1", () => {
    // Le même appel que fait l'évaluation à chaque activité reçue. Une
    // configuration refusée ici est un défi que le moteur classera
    // « non jugeable » et qui restera ouvert tout le mois.
    for (const row of rows) {
      const parsed = readChallengeConfig(row.evaluator, row.config);
      expect(parsed, `configuration refusée : ${row.title}`).not.toBeNull();
    }
  });

  it("aucun objectif collectif n’est glissé dans le tirage individuel", () => {
    // `collective` se juge sur le total de tous les participants, que la
    // validation d'une activité ne calcule pas. Un tel défi ne se validerait
    // jamais — et personne ne s'en apercevrait avant décembre.
    for (const row of rows) {
      expect(row.evaluator, row.title).not.toBe("collective");
    }
  });
});

describe("le sport annoncé et le sport évalué disent la même chose", () => {
  it("un défi de course ne se valide pas à vélo", () => {
    // `sport_family` décide À QUI le défi est attribué, `config.sport_types`
    // décide CE QUI le valide. Les deux qui divergent produisent un défi
    // attribué aux coureurs et validé par n'importe quoi — ou l'inverse, un
    // défi que son destinataire ne peut pas réussir.
    for (const row of rows) {
      const types = row.config.sport_types as string[] | undefined;
      if (!types) continue; // multisport et surprise n'en portent pas toujours

      if (row.sportFamily === "any") {
        expect(types, row.title).toContain("any");
      } else {
        expect(types, row.title).toEqual([row.sportFamily]);
      }
    }
  });

  it("le renforcement ne demande jamais une distance", () => {
    // Une séance de salle n'en produit pas : le défi serait impossible.
    for (const row of rows) {
      if (row.sportFamily !== "strength") continue;
      expect(row.evaluator, row.title).not.toBe("distance");
      expect(row.evaluator, row.title).not.toBe("elevation");
    }
  });
});

describe("les fils rouges sont cohérents avec leur fenêtre", () => {
  it("un défi sur plusieurs jours dit combien", () => {
    // La contrainte de base l'impose déjà ; la retrouver ici évite un import
    // qui échoue à mi-parcours sur un message obscur.
    for (const row of rows) {
      if (row.durationScope !== "multi_day") continue;
      expect(row.durationDays, row.title).not.toBeNull();
      expect(row.durationDays!, row.title).toBeGreaterThanOrEqual(1);
      expect(row.durationDays!, row.title).toBeLessThanOrEqual(30);
    }
  });

  it("et un défi de la journée n’en annonce pas", () => {
    for (const row of rows) {
      if (row.durationScope !== "day") continue;
      expect(row.durationDays, row.title).toBeNull();
    }
  });

  it("un cumul sur plusieurs jours le déclare dans sa configuration", () => {
    // `effort: cumulative` sans `window: multi_day` additionne les sorties
    // d'une seule journée : le défi devient bien plus dur que son titre.
    for (const row of rows) {
      if (row.config.effort !== "cumulative") continue;
      expect(row.config.window, row.title).toBe("multi_day");
      expect(row.durationScope, row.title).toBe("multi_day");
    }
  });

  it("et une série tient dans la fenêtre qu’elle annonce", () => {
    for (const row of rows) {
      if (row.evaluator !== "streak") continue;

      const days = row.config.days as number;
      const gaps = (row.config.allowed_gaps as number) ?? 0;

      // La série se juge sur `days` jours : la ligne doit annoncer la même
      // durée, sinon l'écran promet une fenêtre et le moteur en applique une
      // autre.
      expect(row.durationDays, row.title).toBe(days);
      // Une tolérance qui absorbe toute la série ne demande plus rien.
      expect(gaps, row.title).toBeLessThan(days);
    }
  });

  it("un multi-sports aussi", () => {
    for (const row of rows) {
      if (row.evaluator !== "multisport") continue;

      const window = (row.config.window_days as number) ?? 1;

      if (window === 1) {
        expect(row.durationScope, row.title).toBe("day");
      } else {
        expect(row.durationDays, row.title).toBe(window);
      }
    }
  });
});

describe("le catalogue est jouable par tout le monde", () => {
  const byFamily = (family: string) =>
    rows.filter((row) => row.sportFamily === family);

  it("les « tous sports » sont le plus gros bloc", () => {
    // Un participant dont l'historique ne dit encore rien ne peut recevoir
    // QUE ceux-là (architecture D13). C'est le catalogue entier d'un nouvel
    // inscrit pendant ses premiers jours.
    const any = byFamily("any").length;

    for (const family of ["run", "bike", "walk", "swim", "strength"]) {
      expect(any, `« tous sports » vs ${family}`).toBeGreaterThan(
        byFamily(family).length,
      );
    }
  });

  it("et ils suffisent à eux seuls à remplir un mois sans répétition", () => {
    // Trente jours, un défi par jour, jamais deux fois le même.
    expect(byFamily("any").length).toBeGreaterThanOrEqual(20);
  });

  it("aucune famille de sport n’est oubliée", () => {
    for (const family of ["any", "run", "bike", "walk", "swim", "strength"]) {
      expect(byFamily(family).length, family).toBeGreaterThan(0);
    }
  });

  it("chaque famille a une porte d’entrée facile", () => {
    // Sans défi facile, une famille n'est ouverte qu'aux gens déjà entraînés —
    // et le jeu s'adresse d'abord à des collègues.
    for (const family of ["any", "run", "bike", "walk", "swim", "strength"]) {
      const easy = byFamily(family).filter(
        (row) => row.difficulty === "facile",
      );
      expect(easy.length, family).toBeGreaterThan(0);
    }
  });

  it("et les trois niveaux de difficulté existent", () => {
    for (const level of ["facile", "moyen", "difficile"]) {
      expect(
        rows.filter((row) => row.difficulty === level).length,
        level,
      ).toBeGreaterThan(5);
    }
  });
});

describe("les points restent défendables", () => {
  it("tiennent dans les bornes de la base", () => {
    for (const row of rows) {
      expect(row.points, row.title).toBeGreaterThanOrEqual(1);
      expect(row.points, row.title).toBeLessThanOrEqual(1000);
    }
  });

  it("et aucun défi ne pèse à lui seul une part écrasante du mois", () => {
    // Le tirage est aléatoire : un défi qui vaudrait le quart d'un mois
    // ferait dépendre le classement de la chance plutôt que de l'effort.
    const typical = 20; // un défi moyen
    const month = typical * 30;
    const heaviest = Math.max(...rows.map((row) => row.points));

    expect(heaviest / month).toBeLessThan(0.25);
  });

  it("un fil rouge rapporte plus qu’un défi de la journée", () => {
    const longest = Math.max(
      ...rows
        .filter((row) => row.durationScope === "multi_day")
        .map((row) => row.points),
    );
    const daily = Math.max(
      ...rows
        .filter((row) => row.durationScope === "day")
        .map((row) => row.points),
    );

    expect(longest).toBeGreaterThan(daily);
  });
});

describe("le fichier se relance sans rien casser", () => {
  it("n’insère pas un défi déjà présent sous le même titre", () => {
    expect(source).toMatch(/and not exists \(/);
    expect(source).toMatch(/c\.title = v\.title/);
  });

  it("et les titres sont uniques entre eux", () => {
    const titles = rows.map((row) => row.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("chaque défi porte une description, pas seulement un titre", () => {
    // C'est la phrase que le participant lit le matin sur son téléphone.
    for (const row of rows) {
      expect(row.title.length, row.title).toBeGreaterThanOrEqual(3);
      expect(row.title.length, row.title).toBeLessThanOrEqual(120);
      expect(row.description.length, row.title).toBeGreaterThan(15);
    }
  });
});
