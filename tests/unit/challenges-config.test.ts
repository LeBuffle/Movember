import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluatorOptions,
  parseChallengeConfig,
  readChallengeConfig,
} from "@/lib/challenges/config";
import {
  EVALUATOR_KEYS,
  EVALUATORS,
  isEvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import { SPORT_FAMILIES, SPORT_FAMILY_LABELS } from "@/lib/challenges/sports";

const root = path.resolve(import.meta.dirname, "../..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260804120000_challenges.sql"),
  "utf8",
);

/* =========================================================================
 * La validation est le vrai livrable de cette story
 *
 * Un jsonb que personne ne vérifie est une promesse de panne : un seuil saisi
 * en kilomètres là où le code compte des mètres donne un défi que personne ne
 * peut réussir, et le défaut ne se voit qu'à l'évaluation — un matin de
 * novembre, devant quatre cents personnes.
 * ====================================================================== */

describe("le registre des évaluateurs", () => {
  it("déclare les sept types prévus", () => {
    expect([...EVALUATOR_KEYS].sort()).toEqual([
      "collective",
      "distance",
      "duration",
      "elevation",
      "multisport",
      "streak",
      "surprise",
    ]);
  });

  it("décrit chaque type dans les mots d’un bénévole", () => {
    for (const key of EVALUATOR_KEYS) {
      const definition = EVALUATORS[key];

      expect(definition.label.length).toBeGreaterThan(2);
      expect(definition.description.length).toBeGreaterThan(20);
      // Pas de jargon anglais dans ce qui est affiché.
      expect(definition.label).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it("dit lesquels ont besoin de l’historique", () => {
    // Déclaré ici plutôt que découvert plus tard : `streak` et `multisport`
    // regardent un ensemble d'activités, pas celle qui vient d'arriver. La
    // story 4.3 doit le savoir avant de figer la signature d'évaluation.
    expect(EVALUATORS.streak.needsHistory({})).toBe(true);
    expect(EVALUATORS.multisport.needsHistory({})).toBe(true);
    expect(EVALUATORS.collective.isCollective).toBe(true);
  });

  it("laisse le réglage du défi décider, pour les seuils", () => {
    // Depuis que l'effort se règle par défi, la réponse dépend du défi et
    // plus seulement de son type : « en une sortie » se juge sur l'activité
    // qui arrive, « en cumulant » sur toute la fenêtre.
    expect(EVALUATORS.distance.needsHistory({ effort: "single" })).toBe(false);
    expect(EVALUATORS.distance.needsHistory({ effort: "cumulative" })).toBe(
      true,
    );
    expect(EVALUATORS.duration.needsHistory({ effort: "cumulative" })).toBe(
      true,
    );
    expect(EVALUATORS.elevation.needsHistory({ effort: "cumulative" })).toBe(
      true,
    );

    // Un défi écrit avant que le réglage existe garde le sens de sa phrase.
    expect(EVALUATORS.distance.needsHistory({})).toBe(false);
  });

  it("alimente le formulaire du back-office", () => {
    // La story 4.2 en dépend : ajouter un évaluateur ne doit pas demander de
    // retoucher le formulaire.
    expect(evaluatorOptions()).toHaveLength(EVALUATOR_KEYS.length);
  });

  it("reconnaît un type inconnu", () => {
    expect(isEvaluatorKey("distance")).toBe(true);
    expect(isEvaluatorKey("téléportation")).toBe(false);
  });
});

describe("validation des configurations", () => {
  it("accepte un défi de distance bien réglé", () => {
    const result = parseChallengeConfig("distance", {
      min_distance_meters: 5000,
      sport_types: ["run"],
      window: "day",
    });

    expect(result.ok).toBe(true);
  });

  it("refuse un type de défi qui n’existe pas", () => {
    const result = parseChallengeConfig("téléportation", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/n’existe pas/);
    }
  });

  it.each([
    ["une configuration vide", "distance", {}],
    [
      "un seuil négatif",
      "distance",
      { min_distance_meters: -5, sport_types: ["run"] },
    ],
    [
      "un seuil à zéro",
      "distance",
      { min_distance_meters: 0, sport_types: ["run"] },
    ],
    [
      "un seuil décimal",
      "distance",
      { min_distance_meters: 5.5, sport_types: ["run"] },
    ],
    ["aucun sport", "distance", { min_distance_meters: 5000, sport_types: [] }],
    [
      "un sport inconnu",
      "distance",
      { min_distance_meters: 5000, sport_types: ["equitation"] },
    ],
    [
      "une fenêtre inconnue",
      "distance",
      { min_distance_meters: 5000, sport_types: ["run"], window: "semaine" },
    ],
    [
      "une régularité de 40 jours",
      "streak",
      { days: 40, sport_types: ["run"] },
    ],
    [
      "une seule condition surprise",
      "surprise",
      { conditions: [{ evaluator: "distance", config: {} }] },
    ],
  ])("refuse %s", (_label, evaluator, config) => {
    expect(parseChallengeConfig(evaluator, config).ok).toBe(false);
  });

  it("attrape la faute la plus probable du catalogue", () => {
    // Quelqu'un tape « 5 » en pensant kilomètres, dans un champ qui compte
    // des mètres. Le défi devient trivial, et personne ne s'en aperçoit
    // avant que 400 personnes l'aient validé sans effort.
    //
    // On ne peut pas le refuser — 5 mètres est un nombre valide. Mais
    // l'inverse, 5000 saisi en pensant mètres dans un champ kilomètres, est
    // borné : au-delà de 200 km, c'est forcément une erreur de frappe.
    expect(
      parseChallengeConfig("distance", {
        min_distance_meters: 5_000_000,
        sport_types: ["run"],
      }).ok,
    ).toBe(false);
  });

  it("nomme le champ en français dans ses messages", () => {
    // « config.min_distance_meters: Expected number, received string »
    // n'aide personne. Le message s'adresse à un bénévole.
    const result = parseChallengeConfig("distance", {
      min_distance_meters: "cinq mille",
      sport_types: ["run"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/Distance minimale/);
      expect(result.errors.join(" ")).not.toMatch(
        /Expected|received|invalid_type/,
      );
    }
  });

  it("dit qu’un réglage est obligatoire plutôt que « attendu number »", () => {
    const result = parseChallengeConfig("distance", { sport_types: ["run"] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/obligatoire/);
    }
  });

  it("refuse une configuration qui n’est pas un objet", () => {
    for (const bad of [null, "5000", 5000, ["run"]]) {
      expect(parseChallengeConfig("distance", bad).ok).toBe(false);
    }
  });

  it("applique les valeurs par défaut", () => {
    const result = parseChallengeConfig("distance", {
      min_distance_meters: 5000,
      sport_types: ["run"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.window).toBe("day");
  });
});

describe("relecture d’une configuration stockée", () => {
  it("refuse une configuration devenue invalide", () => {
    // Une ligne peut être modifiée directement en SQL, et une configuration
    // écrite il y a des mois peut précéder un changement de schéma. Un
    // évaluateur à qui l'on passe une configuration qu'il ne comprend pas
    // planterait — ou pire, jugerait autre chose en silence.
    expect(readChallengeConfig("distance", { min_distance_meters: -1 })).toBe(
      null,
    );
  });

  it("rend la configuration quand elle est valide", () => {
    const config = readChallengeConfig("duration", {
      min_duration_seconds: 1800,
      sport_types: ["any"],
    });

    expect(config?.min_duration_seconds).toBe(1800);
  });
});

describe("familles de sport", () => {
  it("restent volontairement grossières", () => {
    // Strava rapporte des dizaines de types — Run, TrailRun, VirtualRun,
    // Treadmill — et l'auteur d'un défi n'a pas à choisir entre eux.
    expect(SPORT_FAMILIES.length).toBeLessThanOrEqual(6);
  });

  it("prévoient un repli « tous sports »", () => {
    // Ce qui rend possible un défi de rattrapage pour quelqu'un dont
    // l'historique ne dit encore rien (architecture D13).
    expect(SPORT_FAMILIES).toContain("any");
  });

  it("sont toutes étiquetées en français", () => {
    for (const family of SPORT_FAMILIES) {
      expect(SPORT_FAMILY_LABELS[family]).toBeTruthy();
    }
  });
});

/* =========================================================================
 * Ce que la base garantit toute seule
 * ====================================================================== */

describe("le schéma du catalogue", () => {
  it("borne les points", () => {
    // Une colonne de points sans borne est à une faute de frappe de rendre
    // un seul défi équivalent au mois entier.
    expect(migration).toMatch(
      /points\s+integer[\s\S]{0,80}between 1 and 1000/i,
    );
  });

  it("refuse un type d’évaluateur que l’application ne sait pas évaluer", () => {
    expect(migration).toMatch(/evaluator in \(/i);
  });

  it("refuse un défi multi-jours sans nombre de jours", () => {
    expect(migration).toMatch(/challenges_multi_day_has_days/i);
  });

  it("interdit deux fois le même défi tiré au sort", () => {
    expect(migration).toMatch(
      /unique index challenge_assignments_no_repeat[\s\S]*?where source = 'draw'/i,
    );
  });

  it("rend la tâche quotidienne rejouable", () => {
    // Un cron qui échoue à mi-parcours sera relancé. Sans cet index, la
    // seconde exécution donne un second défi à ceux qui en avaient un.
    expect(migration).toMatch(
      /unique index challenge_assignments_one_draw_per_day[\s\S]*?where source = 'draw'/i,
    );
  });

  it("garde une copie des points au moment de la réussite", () => {
    // La valeur du catalogue peut être corrigée en cours d'édition ; ce qui
    // est déjà gagné ne doit pas bouger.
    expect(migration).toMatch(/points_awarded\s+integer/i);
  });

  it("n’autorise personne à écrire une attribution", () => {
    // Un participant capable d'insérer une attribution se donnerait un défi
    // facile ; capable de la modifier, il la marquerait réussie. C'est le
    // classement qui est protégé ici.
    const writePolicies = [
      ...migration.matchAll(
        /create\s+policy[\s\S]*?on\s+public\.challenge_assignments\s+for\s+(\w+)/gi,
      ),
    ].map((m) => m[1].toLowerCase());

    expect(writePolicies.length).toBeGreaterThan(0);
    for (const verb of ["insert", "update", "delete", "all"]) {
      expect(writePolicies).not.toContain(verb);
    }
  });

  it("ne laisse pas un participant lire tout le catalogue", () => {
    // Il connaîtrait les défis à venir, et la surprise quotidienne perdrait
    // tout intérêt.
    expect(migration).toMatch(
      /participants read only their assigned challenges[\s\S]*?exists\s*\(/i,
    );
  });
});
