import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { addDays, type Activity } from "@/lib/activities/activity";
import {
  evaluate,
  isEvaluable,
  type EvaluationInput,
} from "@/lib/challenges/evaluators/evaluate";
import {
  EVALUATORS,
  EVALUATOR_KEYS,
} from "@/lib/challenges/evaluators/registry";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Les six autres mécaniques
 *
 * Cette story n'est facile que si la 4.3 a bien conçu le modèle. La preuve
 * qu'elle l'a fait : chaque type est une addition, et ni le formulaire, ni le
 * tirage, ni l'affichage n'ont bougé.
 * ====================================================================== */

const DAY = "2026-11-15";
const CONTEXT = { assignedFor: DAY, durationDays: 1 };

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    provider: "simulated",
    profileId: "profil-1",
    name: "Sortie",
    sportFamily: "run",
    startedAt: `${DAY}T07:00:00.000Z`,
    localDate: DAY,
    distanceMeters: 5000,
    durationSeconds: 1800,
    elevationMeters: 100,
    ...overrides,
  };
}

const judge = (
  evaluator: string,
  config: Record<string, unknown>,
  extra: Partial<EvaluationInput> = {},
) =>
  evaluate(evaluator, {
    activity: activity(),
    config,
    context: CONTEXT,
    ...extra,
  });

/* ---------------------------------------------------------------------------
 * Durée et dénivelé — mêmes règles que la distance, autre mesure
 * ------------------------------------------------------------------------ */

describe("le défi de durée", () => {
  const config = {
    min_duration_seconds: 1800,
    sport_types: ["run"],
    window: "day",
  };

  it("est réussi au seuil exact", () => {
    expect(judge("duration", config).completed).toBe(true);
  });

  it("n’est pas réussi une seconde en dessous", () => {
    expect(
      judge("duration", config, {
        activity: activity({ durationSeconds: 1799 }),
      }).completed,
    ).toBe(false);
  });

  it("refuse un sport hors liste", () => {
    const verdict = judge("duration", config, {
      activity: activity({ sportFamily: "swim", durationSeconds: 7200 }),
    });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed) expect(verdict.reason).toMatch(/sport/i);
  });

  it("refuse une activité hors fenêtre", () => {
    expect(
      judge("duration", config, {
        activity: activity({ localDate: addDays(DAY, 1) }),
      }).completed,
    ).toBe(false);
  });
});

describe("le défi de dénivelé", () => {
  const config = {
    min_elevation_meters: 100,
    sport_types: ["any"],
    window: "day",
  };

  it("est réussi au seuil exact", () => {
    expect(judge("elevation", config).completed).toBe(true);
  });

  it("refuse une sortie plate", () => {
    // Le cas ordinaire, pas une anomalie : une piscine ne monte pas.
    const verdict = judge("elevation", config, {
      activity: activity({ sportFamily: "swim", elevationMeters: 0 }),
    });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed && "measured" in verdict) {
      expect(verdict.measured).toBe(0);
    }
  });
});

/* ---------------------------------------------------------------------------
 * Régularité
 * ------------------------------------------------------------------------ */

describe("le défi de régularité", () => {
  const config = {
    days: 3,
    sport_types: ["run"],
    allowed_gaps: 0,
  };

  const runs = (dates: string[]): Activity[] =>
    dates.map((localDate, index) =>
      activity({ id: `act-${index}`, localDate }),
    );

  it("refuse de juger sans historique", () => {
    // « Pas encore jugé » n'est pas « raté ». L'historique arrive avec le
    // lot 3 ; d'ici là, ce défi reste ouvert plutôt que d'être perdu.
    const verdict = judge("streak", config);

    expect(verdict.completed).toBe(false);
    expect("unsupported" in verdict).toBe(true);
  });

  it("est réussi quand les trois jours sont là", () => {
    const history = runs([DAY, addDays(DAY, 1), addDays(DAY, 2)]);

    expect(
      judge("streak", config, {
        history,
        activity: history[2]!,
      }).completed,
    ).toBe(true);
  });

  it("ne compte pas deux activités du même jour pour deux jours", () => {
    // La faute qui rendrait un défi de trois jours réussi en une matinée.
    const history = runs([DAY, DAY, DAY]);

    expect(
      judge("streak", config, { history, activity: history[2]! }).completed,
    ).toBe(false);
  });

  it("ne se valide pas sur des jours qui n’ont pas eu lieu", () => {
    // L'historique pourrait contenir une activité datée du futur — une
    // horloge mal réglée, un import. Le défi ne doit pas se clore dessus.
    const history = runs([DAY, addDays(DAY, 1), addDays(DAY, 2)]);

    expect(
      judge("streak", config, { history, activity: history[0]! }).completed,
    ).toBe(false);
  });

  it("supporte une interruption quand la tolérance le prévoit", () => {
    // Une série sans tolérance est une série qui s'arrête au troisième jour
    // pour la plupart des gens, et cesse alors de motiver qui que ce soit.
    const history = runs([DAY, addDays(DAY, 2)]);

    expect(
      judge(
        "streak",
        { ...config, allowed_gaps: 1 },
        { history, activity: history[1]! },
      ).completed,
    ).toBe(true);
  });

  it("ignore les jours trop courts quand une durée minimale est exigée", () => {
    const history = [
      activity({ id: "a", localDate: DAY, durationSeconds: 600 }),
      activity({ id: "b", localDate: addDays(DAY, 1), durationSeconds: 1800 }),
      activity({ id: "c", localDate: addDays(DAY, 2), durationSeconds: 1800 }),
    ];

    expect(
      judge(
        "streak",
        { ...config, min_duration_seconds_per_day: 1200 },
        { history, activity: history[2]! },
      ).completed,
    ).toBe(false);
  });

  it("ignore les activités hors sport et hors fenêtre", () => {
    const history = [
      activity({ id: "a", localDate: addDays(DAY, -1) }),
      activity({ id: "b", localDate: DAY, sportFamily: "swim" }),
      activity({ id: "c", localDate: addDays(DAY, 1) }),
    ];

    const verdict = judge("streak", config, {
      history,
      activity: history[2]!,
    });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed && "measured" in verdict) {
      expect(verdict.measured).toBe(1);
    }
  });

  it("refuse un défi sans nombre de jours", () => {
    expect("unsupported" in judge("streak", { ...config, days: 0 })).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * Multi-sports
 * ------------------------------------------------------------------------ */

describe("le défi multi-sports", () => {
  const config = {
    distinct_sports: 3,
    sport_types: ["any"],
    window_days: 7,
  };

  it("refuse de juger sans historique", () => {
    expect("unsupported" in judge("multisport", config)).toBe(true);
  });

  it("est réussi avec trois sports différents", () => {
    const history = [
      activity({ id: "a", sportFamily: "run" }),
      activity({ id: "b", sportFamily: "bike", localDate: addDays(DAY, 1) }),
      activity({ id: "c", sportFamily: "swim", localDate: addDays(DAY, 2) }),
    ];

    expect(
      judge("multisport", config, { history, activity: history[2]! }).completed,
    ).toBe(true);
  });

  it("ne compte pas trois fois le même sport", () => {
    const history = [
      activity({ id: "a", sportFamily: "run" }),
      activity({ id: "b", sportFamily: "run", localDate: addDays(DAY, 1) }),
      activity({ id: "c", sportFamily: "run", localDate: addDays(DAY, 2) }),
    ];

    const verdict = judge("multisport", config, {
      history,
      activity: history[2]!,
    });

    expect(verdict.completed).toBe(false);
    if (!verdict.completed && "measured" in verdict) {
      expect(verdict.measured).toBe(1);
    }
  });

  it("ne compte pas une activité que le fournisseur n’a pas su classer", () => {
    // Elle ne dit rien du sport pratiqué : elle ne peut pas compter dans un
    // décompte de sports *différents*.
    const history = [
      activity({ id: "a", sportFamily: "run" }),
      activity({ id: "b", sportFamily: "bike", localDate: addDays(DAY, 1) }),
      activity({ id: "c", sportFamily: "any", localDate: addDays(DAY, 2) }),
    ];

    expect(
      judge("multisport", config, { history, activity: history[2]! }).completed,
    ).toBe(false);
  });

  it("respecte sa fenêtre", () => {
    const history = [
      activity({ id: "a", sportFamily: "run" }),
      activity({ id: "b", sportFamily: "bike", localDate: addDays(DAY, 1) }),
      activity({ id: "c", sportFamily: "swim", localDate: addDays(DAY, 9) }),
    ];

    expect(
      judge("multisport", config, { history, activity: history[2]! }).completed,
    ).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Objectif collectif
 * ------------------------------------------------------------------------ */

describe("l’objectif collectif", () => {
  const config = {
    metric: "distance_meters",
    target: 30_000_000,
    sport_types: ["any"],
  };

  it("refuse de juger tant que le total n’est pas calculé", () => {
    // Le seul évaluateur qui ne peut pas se trancher à l'arrivée d'une
    // activité : il dépend de ce qu'ont fait quatre cents autres personnes.
    expect("unsupported" in judge("collective", config)).toBe(true);
  });

  it("est réussi quand le total atteint l’objectif", () => {
    expect(
      judge("collective", config, { collectiveTotal: 30_000_000 }).completed,
    ).toBe(true);
  });

  it("n’est pas réussi en dessous", () => {
    expect(
      judge("collective", config, { collectiveTotal: 29_999_999 }).completed,
    ).toBe(false);
  });

  it("ne désigne personne comme l’ayant validé", () => {
    // Personne en particulier ne l'a réussi.
    const verdict = judge("collective", config, {
      collectiveTotal: 30_000_000,
    });

    expect(verdict.completed).toBe(true);
    if (verdict.completed) expect(verdict.evidence.activityIds).toEqual([]);
  });

  it("accepte un total à zéro sans le confondre avec « pas calculé »", () => {
    const verdict = judge("collective", config, { collectiveTotal: 0 });

    expect(verdict.completed).toBe(false);
    expect("unsupported" in verdict).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Surprise
 * ------------------------------------------------------------------------ */

describe("le défi surprise", () => {
  const distance = {
    evaluator: "distance",
    config: { min_distance_meters: 5000, sport_types: ["run"], window: "day" },
  };
  const elevation = {
    evaluator: "elevation",
    config: { min_elevation_meters: 100, sport_types: ["any"], window: "day" },
  };
  const impossible = {
    evaluator: "elevation",
    config: { min_elevation_meters: 8000, sport_types: ["any"], window: "day" },
  };

  it("exige toutes les conditions en mode « toutes »", () => {
    expect(
      judge("surprise", { mode: "all", conditions: [distance, elevation] })
        .completed,
    ).toBe(true);

    expect(
      judge("surprise", { mode: "all", conditions: [distance, impossible] })
        .completed,
    ).toBe(false);
  });

  it("se contente d’une condition en mode « une seule »", () => {
    expect(
      judge("surprise", { mode: "any", conditions: [distance, impossible] })
        .completed,
    ).toBe(true);

    expect(
      judge("surprise", { mode: "any", conditions: [impossible, impossible] })
        .completed,
    ).toBe(false);
  });

  it("rassemble ce qui a validé chaque condition, sans doublon", () => {
    const verdict = judge("surprise", {
      mode: "all",
      conditions: [distance, elevation],
    });

    expect(verdict.completed).toBe(true);
    if (verdict.completed)
      expect(verdict.evidence.activityIds).toEqual(["act-1"]);
  });

  it("refuse de juger si une condition ne peut pas l’être", () => {
    // Même en mode « une seule ». Un défi déclaré manqué parce que la
    // condition qui l'aurait sauvé n'a pas pu être évaluée est un verdict
    // que personne ne peut défendre.
    const verdict = judge("surprise", {
      mode: "any",
      conditions: [
        distance,
        { evaluator: "streak", config: { days: 3, sport_types: ["run"] } },
      ],
    });

    expect("unsupported" in verdict).toBe(true);
  });

  it("refuse une condition mal formée", () => {
    expect(
      "unsupported" in
        judge("surprise", { mode: "all", conditions: [{ evaluator: 42 }] }),
    ).toBe(true);
  });

  it("refuse un défi sans condition", () => {
    expect(
      "unsupported" in judge("surprise", { mode: "all", conditions: [] }),
    ).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * Le modèle a tenu
 * ------------------------------------------------------------------------ */

describe("l’ajout des six types", () => {
  it("couvre les sept mécaniques du registre", () => {
    for (const key of EVALUATOR_KEYS) {
      expect(isEvaluable(key)).toBe(true);
    }
  });

  it("respecte ce que le registre annonçait de chacune", () => {
    // La story 4.1 a déclaré `needsHistory` avant d'écrire quoi que ce soit,
    // pour que la 4.3 fige la bonne signature. C'est ce test qui vérifie que
    // la déclaration n'a pas menti.
    for (const key of EVALUATOR_KEYS) {
      const definition = EVALUATORS[key];
      if (!definition.needsHistory || definition.isCollective) continue;

      const verdict = evaluate(key, {
        activity: activity(),
        config:
          key === "streak"
            ? { days: 3, sport_types: ["run"] }
            : { distinct_sports: 2, sport_types: ["any"], window_days: 3 },
        context: CONTEXT,
      });

      // Sans historique, un évaluateur qui en a besoin refuse de juger.
      expect("unsupported" in verdict).toBe(true);
    }
  });

  it("n’a demandé de toucher ni au formulaire, ni au tirage, ni à l’affichage", () => {
    // Le critère d'acceptation 4, et la vraie preuve que le modèle de la
    // story 4.3 était bon : les six types sont une addition à un seul fichier.
    for (const file of [
      "src/components/admin/challenge-form.tsx",
      "src/lib/challenges/draw.ts",
      "src/components/game/challenge-card.tsx",
    ]) {
      expect(code(file)).not.toMatch(
        /evaluateStreak|evaluateMultisport|evaluateCollective|evaluateSurprise/,
      );
    }
  });

  it("reste sans horloge, sans base et sans réseau", () => {
    const evaluator = code("src/lib/challenges/evaluators/evaluate.ts");

    expect(evaluator).not.toMatch(/new Date\(|Date\.now|createClient|fetch\(/);
    expect(evaluator).not.toMatch(/server-only/);
  });
});
