import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  drawChallenge,
  drawSeed,
  seedNumber,
  type DrawCandidate,
} from "@/lib/challenges/draw";
import { todayInParis } from "@/lib/challenges/daily-draw";
import type { SportFamily } from "@/lib/challenges/sports";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260805130000_catchup_assignments.sql"),
  "utf8",
).replace(/--.*$/gm, "");

/* =========================================================================
 * Le tirage doit pouvoir être rejoué sans réfléchir
 *
 * Un cron qui échoue à mi-parcours sera relancé — par le système, ou par
 * quelqu'un d'inquiet à six heures du matin. Trois garanties indépendantes,
 * dont celle-ci : le tirage est déterministe, donc la seconde exécution
 * conclut comme la première.
 * ====================================================================== */

const catalogue = (entries: Array<[string, SportFamily]>): DrawCandidate[] =>
  entries.map(([id, sportFamily]) => ({ id, sportFamily }));

const CATALOGUE = catalogue([
  ["c-run-1", "run"],
  ["c-run-2", "run"],
  ["c-bike-1", "bike"],
  ["c-swim-1", "swim"],
  ["c-any-1", "any"],
  ["c-any-2", "any"],
]);

const draw = (overrides: Partial<Parameters<typeof drawChallenge>[0]> = {}) =>
  drawChallenge({
    candidates: CATALOGUE,
    alreadyReceived: [],
    practisedSports: [],
    seed: "profil-1:2026-11-15",
    ...overrides,
  });

describe("le tirage", () => {
  it("donne toujours le même défi à la même personne le même jour", () => {
    // La propriété qui rend la tâche rejouable avant même que la base s'en
    // mêle. Une tâche dont la justesse ne repose que sur une contrainte est
    // une tâche dont personne ne peut raisonner.
    const first = draw();
    const second = draw();

    expect(first).toEqual(second);
  });

  it("donne des défis différents à des personnes différentes", () => {
    const results = ["a", "b", "c", "d", "e", "f", "g", "h"].map((profile) =>
      draw({ seed: drawSeed(profile, "2026-11-15") }),
    );

    const distinct = new Set(
      results.map((result) => (result.drawn ? result.challengeId : "—")),
    );

    expect(distinct.size).toBeGreaterThan(1);
  });

  it("change de défi d’un jour à l’autre", () => {
    const monday = draw({ seed: drawSeed("profil-1", "2026-11-16") });
    const tuesday = draw({ seed: drawSeed("profil-1", "2026-11-17") });

    // Pas garanti à chaque paire de dates — mais sur ces deux-là, oui, et
    // c'est ce qu'on veut constater.
    expect(monday).not.toEqual(tuesday);
  });

  it("ne dépend pas de l’ordre du catalogue", () => {
    // Deux requêtes peuvent rendre les mêmes lignes dans un ordre différent.
    // Le tirage ne doit pas en dépendre.
    const reversed = [...CATALOGUE].reverse();

    expect(draw()).toEqual(draw({ candidates: reversed }));
  });

  it("ne redonne jamais un défi déjà reçu", () => {
    // La règle qui fait tout l'intérêt d'un catalogue fourni.
    const received: string[] = [];

    for (let day = 0; day < CATALOGUE.length; day += 1) {
      const result = draw({
        alreadyReceived: received,
        seed: `profil-1:jour-${day}`,
      });

      expect(result.drawn).toBe(true);
      if (result.drawn) {
        expect(received).not.toContain(result.challengeId);
        expect(result.catchUp).toBe(false);
        received.push(result.challengeId);
      }
    }

    expect(received).toHaveLength(CATALOGUE.length);
  });

  it("préfère les défis polyvalents quand l’historique ne dit rien", () => {
    // Architecture D13 : plutôt que de deviner, on donne ce qui convient à
    // tout le monde.
    const result = draw({ practisedSports: [] });

    expect(result.drawn).toBe(true);
    if (result.drawn) expect(result.challengeId).toMatch(/^c-any-/);
  });

  it("évite les sports jamais pratiqués", () => {
    // Ce n'est pas de la recommandation, c'est un filtre : ne pas donner un
    // défi de natation à quelqu'un qui n'a jamais nagé.
    for (let day = 0; day < 20; day += 1) {
      const result = draw({
        practisedSports: ["run"],
        alreadyReceived: ["c-any-1", "c-any-2"],
        seed: `profil-x:jour-${day}`,
      });

      expect(result.drawn).toBe(true);
      if (result.drawn) expect(result.challengeId).toMatch(/^c-run-/);
    }
  });

  it("préfère un défi hors sport plutôt qu’un défi déjà fait", () => {
    // Un défi dans un sport qu'on ne pratique peut-être pas vaut mieux qu'un
    // défi déjà réussi.
    const result = draw({
      practisedSports: ["run"],
      alreadyReceived: ["c-run-1", "c-run-2", "c-any-1", "c-any-2"],
    });

    expect(result.drawn).toBe(true);
    if (result.drawn) {
      expect(["c-bike-1", "c-swim-1"]).toContain(result.challengeId);
      expect(result.catchUp).toBe(false);
    }
  });

  it("répète plutôt que de ne rien donner, et le dit", () => {
    // Ne rien attribuer serait la pire réponse : le participant ouvre
    // l'application un matin de novembre et n'a rien à faire.
    const result = draw({
      alreadyReceived: CATALOGUE.map((candidate) => candidate.id),
    });

    expect(result.drawn).toBe(true);
    if (result.drawn) expect(result.catchUp).toBe(true);
  });

  it("refuse seulement quand le catalogue est vide", () => {
    expect(draw({ candidates: [] })).toEqual({
      drawn: false,
      reason: "empty-catalogue",
    });
  });

  it("fonctionne avec un catalogue d’un seul défi", () => {
    const single = catalogue([["c-unique", "any"]]);

    expect(draw({ candidates: single })).toMatchObject({
      drawn: true,
      challengeId: "c-unique",
      catchUp: false,
    });
  });
});

describe("la graine", () => {
  it("est stable", () => {
    expect(seedNumber("profil-1:2026-11-15")).toBe(
      seedNumber("profil-1:2026-11-15"),
    );
  });

  it("distingue deux chaînes proches", () => {
    expect(seedNumber("profil-1:2026-11-15")).not.toBe(
      seedNumber("profil-1:2026-11-16"),
    );
  });

  it("reste un entier positif sur 32 bits", () => {
    for (const value of ["", "a", "profil-très-long".repeat(20), "🧔"]) {
      const hash = seedNumber(value);

      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("nomme la paire personne / jour", () => {
    expect(drawSeed("abc", "2026-11-15")).toBe("abc:2026-11-15");
  });
});

describe("le jour de référence", () => {
  it("est celui de Paris, pas celui du serveur", () => {
    // Un VPS en UTC transformerait « le défi du 1ᵉʳ novembre » en quelque
    // chose distribué à une heure du matin le 31 octobre — et personne ne
    // s'en apercevrait avant qu'un participant dise que son défi a changé
    // pendant la nuit.
    expect(todayInParis(new Date("2026-11-15T23:30:00Z"))).toBe("2026-11-16");
    expect(todayInParis(new Date("2026-11-15T22:30:00Z"))).toBe("2026-11-15");
  });

  it("s’écrit dans le format que le reste compare", () => {
    expect(todayInParis(new Date("2026-07-04T10:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

/* ---------------------------------------------------------------------------
 * Ce que la base garantit
 * ------------------------------------------------------------------------ */

describe("la base rend la tâche rejouable", () => {
  it("n’autorise qu’un défi individuel par personne et par jour", () => {
    // L'index précédent ne couvrait que `draw`. Un rattrapage est un défi
    // individuel lui aussi, et l'oublier aurait laissé une tâche rejouée en
    // distribuer un second — le jour précis où le catalogue faisait déjà
    // défaut.
    expect(migration).toMatch(
      /create unique index challenge_assignments_one_per_day[\s\S]*?source in \('draw', 'catchup'\)/i,
    );
  });

  it("garde la règle « jamais deux fois » pour les seuls tirages", () => {
    // Un rattrapage EST une répétition. L'interdire ici interdirait
    // exactement ce pour quoi il existe.
    expect(migration).not.toMatch(/challenge_assignments_no_repeat/);
  });

  it("nomme le rattrapage plutôt que de le déguiser en tirage", () => {
    expect(migration).toMatch(/'draw', 'common', 'manual', 'catchup'/);
  });
});

describe("la tâche quotidienne", () => {
  const task = code("src/lib/challenges/daily-draw.ts");

  it("saute ceux qui ont déjà leur défi", () => {
    expect(task).toMatch(/hasToday\.has\(profileId\)/);
  });

  it("traite un doublon en base comme un succès, pas comme un échec", () => {
    // Quelqu'un est passé avant — une autre exécution, ou une main sur le
    // bouton. Le participant a son défi, c'est tout ce qui compte.
    expect(task).toMatch(/error\.code === "23505"[\s\S]{0,120}alreadyHad/);
  });

  it("alerte quand le catalogue passe sous le seuil", () => {
    expect(task).toMatch(/CATALOGUE_MINIMUM/);
    expect(task).toMatch(
      /console\.error\("\[tirage\] catalogue sous le seuil"/,
    );
  });

  it("dit ce qu’elle a fait", () => {
    // Le matin où ça se passe mal, quelqu'un lit un fichier de journal sur un
    // téléphone.
    for (const field of [
      "participants",
      "assigned",
      "alreadyHad",
      "catchUps",
      "failures",
    ]) {
      expect(task).toContain(field);
    }
  });

  it("lit tout en une fois plutôt qu’une requête par participant", () => {
    // Quatre cents allers-retours seraient quatre cents occasions d'expirer
    // à mi-parcours.
    expect(task).toMatch(/Promise\.all\(/);
  });

  it("est protégée par le secret des tâches planifiées", () => {
    const route = code("src/app/api/cron/defis-du-jour/route.ts");

    expect(route).toMatch(/isAuthorisedCronRequest\(request\)/);
    expect(route).toMatch(/assignDailyChallenges\(\)/);
  });

  it("est installée par le dépôt, pas à la main sur le serveur", () => {
    expect(code("deploy/crontab")).toContain("/api/cron/defis-du-jour");
  });

  it("se rattrape depuis le back-office avec le même code", () => {
    // Une seconde version du tirage écrite à la main finirait par diverger de
    // la vraie, et divergerait le matin où on en aurait besoin.
    const actions = code("src/lib/challenges/admin-actions.ts");

    expect(actions).toMatch(/assignDailyChallenges\(\)/);
    expect(actions).toContain("challenges.drawn_manually");
  });
});
