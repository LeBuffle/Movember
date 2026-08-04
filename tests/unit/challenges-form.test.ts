import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { parseChallengeConfig } from "@/lib/challenges/config";
import { describeChallenge, formatDuration } from "@/lib/challenges/describe";
import {
  EVALUATORS,
  EVALUATOR_KEYS,
  type EvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import {
  fieldToDisplay,
  fieldToStored,
  parseNumberInput,
  resolveUnit,
  type NumberField,
} from "@/lib/challenges/fields";
import {
  buildConfig,
  challengeDetailsSchema,
  readFormValues,
  valuesFromConfig,
} from "@/lib/challenges/form";

/* =========================================================================
 * Le critère de cette story tient en une phrase
 *
 * Un bénévole sans bagage technique doit créer un défi depuis son téléphone,
 * sans aide et sans documentation. Tout ce qui suit en découle : les unités
 * naturelles, les réglages pilotés par le registre, l'aperçu.
 * ====================================================================== */

function shapeOf(evaluator: EvaluatorKey): string[] {
  const schema = EVALUATORS[evaluator].configSchema as unknown as z.ZodObject<
    Record<string, z.ZodType>
  >;

  return Object.keys(schema.shape);
}

describe("le formulaire est piloté par le registre", () => {
  it.each(EVALUATOR_KEYS)(
    "demande exactement les réglages que %s attend",
    (evaluator) => {
      // Le vrai enjeu : ajouter un évaluateur à la story 4.7 ne doit pas
      // demander de rouvrir le formulaire. Sans ce test, un réglage ajouté au
      // schéma produirait un formulaire incapable de le remplir — donc un
      // défi impossible à enregistrer, sans que rien ne signale pourquoi.
      const declared = EVALUATORS[evaluator].fields.map((field) => field.name);

      expect(declared.slice().sort()).toEqual(shapeOf(evaluator).sort());
    },
  );

  it("n’affiche jamais un nom de code", () => {
    for (const key of EVALUATOR_KEYS) {
      for (const field of EVALUATORS[key].fields) {
        expect(field.label).not.toMatch(/[a-z]+_[a-z]+/);
        expect(field.label.length).toBeGreaterThan(2);
      }
    }
  });
});

describe("les unités demandées sont celles qu’on dit à voix haute", () => {
  const fieldOf = (evaluator: EvaluatorKey, name: string) =>
    EVALUATORS[evaluator].fields.find(
      (field) => field.name === name,
    ) as NumberField;

  it("demande des kilomètres, jamais des mètres", () => {
    // C'est la faute la plus probable du catalogue : quelqu'un tape 5 en
    // pensant kilomètres dans un champ qui compte des mètres. On ne la
    // rattrape pas, on la rend impossible — personne n'a à multiplier par
    // mille de tête.
    const field = fieldOf("distance", "min_distance_meters");

    expect(field.unit).toBe("km");
    expect(fieldToStored(field, "5")).toBe(5000);
  });

  it("demande des minutes, jamais des secondes", () => {
    const field = fieldOf("duration", "min_duration_seconds");

    expect(field.unit).toBe("minutes");
    expect(fieldToStored(field, "30")).toBe(1800);
  });

  it("accepte la virgule décimale", () => {
    // Un clavier de téléphone français propose une virgule. La refuser,
    // c'est refuser l'évidence.
    expect(parseNumberInput("5,5")).toBe(5.5);
    expect(
      fieldToStored(fieldOf("distance", "min_distance_meters"), "5,5"),
    ).toBe(5500);
  });

  it("laisse un champ vide vide, plutôt que zéro", () => {
    // Zéro serait une valeur, et le refus dirait « supérieure à zéro » au
    // lieu de « ce réglage est obligatoire ».
    expect(parseNumberInput("")).toBe(null);
    expect(parseNumberInput("beaucoup")).toBe(null);
  });

  it("suit la donnée choisie pour un objectif collectif", () => {
    const field = fieldOf("collective", "target");

    expect(resolveUnit(field, { metric: "duration_seconds" })).toEqual({
      unit: "heures",
      factor: 3600,
    });
    expect(fieldToStored(field, "10", { metric: "duration_seconds" })).toBe(
      36_000,
    );
    expect(fieldToStored(field, "10", { metric: "activity_count" })).toBe(10);
  });
});

describe("la conversion fait l’aller-retour", () => {
  it("ne multiplie pas un défi par mille à chaque modification", () => {
    // La régression qui compte : ouvrir un défi de 5 km, ne rien changer,
    // enregistrer. Si l'affichage rendait 5000 au lieu de 5, le défi
    // deviendrait 5 000 km au premier passage.
    const stored = {
      min_distance_meters: 5000,
      sport_types: ["run"],
      window: "day",
    };

    const { values } = valuesFromConfig("distance", stored);
    expect(values.min_distance_meters).toBe("5");

    expect(buildConfig("distance", values)).toEqual(stored);
  });

  it("rend un nombre lisible, pas 5.000", () => {
    const field = EVALUATORS.distance.fields.find(
      (f) => f.name === "min_distance_meters",
    ) as NumberField;

    expect(fieldToDisplay(field, 5000)).toBe("5");
    expect(fieldToDisplay(field, 5500)).toBe("5.5");
    expect(fieldToDisplay(field, undefined)).toBe("");
  });
});

describe("du formulaire à la configuration", () => {
  const formOf = (entries: Array<[string, string]>) => {
    const data = new FormData();
    for (const [key, value] of entries) data.append(key, value);
    return data;
  };

  it("relit les réglages envoyés", () => {
    const { config } = readFormValues(
      formOf([
        ["title", "ignoré ici"],
        ["config.min_distance_meters", "5"],
        ["config.sport_types", "run"],
        ["config.sport_types", "bike"],
        ["config.window", "day"],
      ]),
    );

    expect(config.min_distance_meters).toBe("5");
    expect(config.sport_types).toEqual(["run", "bike"]);
  });

  it("relit les conditions d’un défi surprise", () => {
    const { conditions } = readFormValues(
      formOf([
        ["condition.0.evaluator", "distance"],
        ["condition.0.min_distance_meters", "5"],
        ["condition.0.sport_types", "run"],
        ["condition.1.evaluator", "elevation"],
        ["condition.1.min_elevation_meters", "300"],
        ["condition.1.sport_types", "bike"],
      ]),
    );

    expect(conditions).toHaveLength(2);
    expect(conditions[1].evaluator).toBe("elevation");
    expect(conditions[1].values.min_elevation_meters).toBe("300");
  });

  it("assemble un défi surprise valide", () => {
    const config = buildConfig("surprise", { mode: "all" }, [
      {
        evaluator: "distance",
        values: { min_distance_meters: "5", sport_types: ["run"] },
      },
      {
        evaluator: "elevation",
        values: { min_elevation_meters: "300", sport_types: ["bike"] },
      },
    ]);

    expect(parseChallengeConfig("surprise", config).ok).toBe(true);
  });

  it("dit quelle condition est fautive", () => {
    // « Distance minimale : ce réglage est obligatoire » ne dirait pas
    // laquelle des quatre conditions corriger.
    const config = buildConfig("surprise", { mode: "all" }, [
      { evaluator: "distance", values: { sport_types: ["run"] } },
      {
        evaluator: "elevation",
        values: { min_elevation_meters: "300", sport_types: ["bike"] },
      },
    ]);

    const result = parseChallengeConfig("surprise", config);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/Condition 1/);
  });

  it("laisse le schéma réclamer un réglage manquant", () => {
    const config = buildConfig("distance", { sport_types: ["run"] });

    expect(config).not.toHaveProperty("min_distance_meters");
    const result = parseChallengeConfig("distance", config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/obligatoire/);
  });

  it("garde une liste de sports vide, pour que le message soit le bon", () => {
    const config = buildConfig("distance", { min_distance_meters: "5" });

    const result = parseChallengeConfig("distance", config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/au moins un sport/);
    }
  });
});

describe("le défi lui-même", () => {
  const valid = {
    title: "5 km avant le café",
    description: "",
    evaluator: "distance",
    sport_family: "run",
    difficulty: "moyen",
    points: 10,
    duration_scope: "day",
    duration_days: null,
  };

  it("accepte un défi bien rempli", () => {
    expect(challengeDetailsSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["un titre trop court", { title: "5" }],
    ["zéro point", { points: 0 }],
    ["plus de mille points", { points: 1001 }],
    ["des points décimaux", { points: 10.5 }],
    ["une difficulté inventée", { difficulty: "impossible" }],
    ["un sport inventé", { sport_family: "equitation" }],
    ["un type de défi inconnu", { evaluator: "téléportation" }],
    [
      "plusieurs jours sans nombre de jours",
      { duration_scope: "multi_day", duration_days: null },
    ],
  ])("refuse %s", (_label, patch) => {
    expect(
      challengeDetailsSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false);
  });
});

/* =========================================================================
 * L'aperçu — le dernier filet
 * ====================================================================== */

describe("l’aperçu dit ce que la machine a compris", () => {
  it("rend visible la faute que les bornes ne peuvent pas attraper", () => {
    // 5 mètres est un nombre parfaitement valide : aucune validation ne peut
    // le refuser. Ce qui l'attrape, c'est de lire « Parcourir 5 m » et de
    // voir que ce n'est pas ce qu'on voulait dire.
    expect(
      describeChallenge("distance", {
        min_distance_meters: 5,
        sport_types: ["run"],
        window: "day",
      }).join(" "),
    ).toMatch(/5 m /);

    expect(
      describeChallenge("distance", {
        min_distance_meters: 5000,
        sport_types: ["run"],
        window: "day",
      }).join(" "),
    ).toMatch(/5 km/);
  });

  it("écrit les durées comme on les dit", () => {
    expect(formatDuration(1800)).toBe("30 minutes");
    expect(formatDuration(3600)).toBe("1 heure");
    expect(formatDuration(5400)).toBe("1 heure et 30 minutes");
  });

  it("sépare les sports en une phrase à part", () => {
    // « en course à pied » et « à vélo » ne prennent pas la même
    // préposition ; une phrase séparée est correcte pour les six familles.
    const lines = describeChallenge("distance", {
      min_distance_meters: 5000,
      sport_types: ["run", "bike"],
      window: "day",
    });

    expect(lines.join(" ")).toMatch(/course à pied, vélo/);
  });

  it("ne nomme aucun sport quand tous conviennent", () => {
    const lines = describeChallenge("duration", {
      min_duration_seconds: 1800,
      sport_types: ["any"],
      window: "day",
    });

    expect(lines.join(" ")).toMatch(/Tous les sports/);
  });

  it("détaille les conditions d’un défi surprise", () => {
    const lines = describeChallenge("surprise", {
      mode: "any",
      conditions: [
        {
          evaluator: "distance",
          config: {
            min_distance_meters: 5000,
            sport_types: ["run"],
            window: "day",
          },
        },
        {
          evaluator: "elevation",
          config: {
            min_elevation_meters: 300,
            sport_types: ["bike"],
            window: "day",
          },
        },
      ],
    });

    expect(lines[0]).toMatch(/une seule des 2 conditions/i);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/5 km/);
  });

  it("refuse d’inventer une phrase quand il manque un réglage", () => {
    // Un aperçu qui devine serait cru. C'est pire que pas d'aperçu.
    expect(
      describeChallenge("distance", { sport_types: ["run"] }).join(" "),
    ).toMatch(/incomplets/);
  });

  it("décrit les sept types sans jamais montrer de nom de code", () => {
    const samples: Record<EvaluatorKey, Record<string, unknown>> = {
      distance: { min_distance_meters: 5000, sport_types: ["run"] },
      duration: { min_duration_seconds: 1800, sport_types: ["any"] },
      elevation: { min_elevation_meters: 300, sport_types: ["bike"] },
      streak: { days: 5, sport_types: ["any"], allowed_gaps: 1 },
      multisport: { distinct_sports: 3, sport_types: ["any"], window_days: 7 },
      collective: {
        metric: "distance_meters",
        target: 30_000_000,
        sport_types: ["any"],
      },
      surprise: {
        mode: "all",
        conditions: [
          {
            evaluator: "distance",
            config: { min_distance_meters: 5000, sport_types: ["run"] },
          },
          {
            evaluator: "duration",
            config: { min_duration_seconds: 1800, sport_types: ["any"] },
          },
        ],
      },
    };

    for (const key of EVALUATOR_KEYS) {
      const text = describeChallenge(key, samples[key]).join(" ");

      expect(text).not.toMatch(/incomplets/);
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it("affiche un objectif collectif dans son unité", () => {
    expect(
      describeChallenge("collective", {
        metric: "distance_meters",
        target: 30_000_000,
        sport_types: ["any"],
      }).join(" "),
    ).toMatch(/30 000 km/);

    expect(
      describeChallenge("collective", {
        metric: "activity_count",
        target: 1200,
        sport_types: ["any"],
      }).join(" "),
    ).toMatch(/1 200 activités/);
  });
});
