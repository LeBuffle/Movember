import { z } from "zod";

import {
  EVALUATORS,
  isEvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import { fieldToDisplay, fieldToStored } from "@/lib/challenges/fields";
import { DIFFICULTIES, SPORT_FAMILIES } from "@/lib/challenges/sports";

/**
 * What the back-office form holds, and how it becomes a configuration.
 *
 * One implementation for both sides. The browser keeps these values in state
 * to show the live preview; the server rebuilds them from the submitted form
 * and validates. Writing the conversion twice would eventually give a preview
 * that disagrees with what is saved — and the preview is the thing story 4.2
 * asks a volunteer to trust.
 *
 * Everything here is strings, because that is what a form produces. The
 * conversion to numbers, and from kilometres to metres, happens in one place
 * (`fields.ts`).
 */

export type ConfigValues = Record<string, string | string[]>;

/** One line of a surprise challenge: a nested evaluator with its own values. */
export type ConditionValues = {
  evaluator: string;
  values: ConfigValues;
};

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * Turns what was typed into the configuration that gets stored and validated.
 *
 * A missing value is **left out** rather than sent as an empty string: the
 * schema then reports "ce réglage est obligatoire", which is what a volunteer
 * needs to read, instead of a type error about an empty string.
 */
export function buildConfig(
  evaluator: string,
  values: ConfigValues,
  conditions: ConditionValues[] = [],
): Record<string, unknown> {
  if (!isEvaluatorKey(evaluator)) return {};

  const config: Record<string, unknown> = {};

  for (const field of EVALUATORS[evaluator].fields) {
    switch (field.kind) {
      case "number": {
        const stored = fieldToStored(field, values[field.name], values);
        if (stored !== null) config[field.name] = stored;
        break;
      }

      case "sports": {
        // Kept even when empty, so the refusal reads "Choisissez au moins un
        // sport" rather than "ce réglage est obligatoire".
        config[field.name] = asArray(values[field.name]);
        break;
      }

      case "choice": {
        const chosen = values[field.name];
        if (typeof chosen === "string" && chosen !== "") {
          config[field.name] = chosen;
        }
        break;
      }

      case "conditions": {
        config[field.name] = conditions.map((condition) => ({
          evaluator: condition.evaluator,
          config: buildConfig(condition.evaluator, condition.values),
        }));
        break;
      }
    }
  }

  return config;
}

/**
 * Reads the submitted form back into the same shape the browser holds.
 *
 * Settings arrive as `config.<nom>`, and a surprise challenge's conditions as
 * `condition.<rang>.<nom>` — a flat encoding, so the form stays an ordinary
 * `<form>`. Nothing is serialised to JSON on the way: a form that only works
 * with JavaScript running is a form that fails silently on a phone with a bad
 * connection, in November, at six in the morning.
 */
export function readFormValues(formData: FormData): {
  config: ConfigValues;
  conditions: ConditionValues[];
} {
  const config: ConfigValues = {};
  const conditions: ConditionValues[] = [];

  const add = (target: ConfigValues, name: string, value: string) => {
    const current = target[name];

    if (current === undefined) target[name] = value;
    else if (Array.isArray(current)) current.push(value);
    else target[name] = [current, value];
  };

  const conditionAt = (rank: number): ConditionValues => {
    conditions[rank] ??= { evaluator: "", values: {} };
    return conditions[rank];
  };

  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;

    if (key.startsWith("config.")) {
      add(config, key.slice("config.".length), raw);
      continue;
    }

    if (key.startsWith("condition.")) {
      const [rank, ...rest] = key.slice("condition.".length).split(".");
      const index = Number(rank);
      const name = rest.join(".");

      if (!Number.isInteger(index) || index < 0 || name === "") continue;

      if (name === "evaluator") conditionAt(index).evaluator = raw;
      else add(conditionAt(index).values, name, raw);
    }
  }

  // A rank can be missing when a middle condition was removed before
  // submitting. Compacting keeps the numbering shown to the volunteer — and
  // in the error messages — in step with the list.
  return { config, conditions: conditions.filter(Boolean) };
}

/**
 * The reverse, for editing an existing challenge.
 *
 * Stored settings come back in the unit they were stored in; the form shows
 * them in the unit the volunteer types. Someone opening a 5 km challenge sees
 * "5", not "5000" — otherwise the first edit of any challenge would multiply
 * it by a thousand.
 */
export function valuesFromConfig(
  evaluator: string,
  config: Record<string, unknown>,
): { values: ConfigValues; conditions: ConditionValues[] } {
  if (!isEvaluatorKey(evaluator)) return { values: {}, conditions: [] };

  const values: ConfigValues = {};
  let conditions: ConditionValues[] = [];

  for (const field of EVALUATORS[evaluator].fields) {
    const stored = config[field.name];

    switch (field.kind) {
      case "number":
        values[field.name] = fieldToDisplay(field, stored, config);
        break;

      case "sports":
        values[field.name] = Array.isArray(stored) ? stored.map(String) : [];
        break;

      case "choice":
        values[field.name] =
          typeof stored === "string" ? stored : (field.options[0]?.value ?? "");
        break;

      case "conditions":
        conditions = (Array.isArray(stored) ? stored : []).map((entry) => {
          const { evaluator: key, config: inner } = (entry ?? {}) as {
            evaluator?: unknown;
            config?: unknown;
          };

          const name = typeof key === "string" ? key : "";

          return {
            evaluator: name,
            values:
              inner && typeof inner === "object"
                ? valuesFromConfig(name, inner as Record<string, unknown>)
                    .values
                : {},
          };
        });
        break;
    }
  }

  return { values, conditions };
}

/** An empty set of values, for a type just picked in the form. */
export function blankValues(evaluator: string): {
  values: ConfigValues;
  conditions: ConditionValues[];
} {
  return valuesFromConfig(evaluator, {});
}

/* -------------------------------------------------------------------------
 * The challenge itself, around its configuration
 * ---------------------------------------------------------------------- */

const requiredText = (label: string) =>
  z.string({ error: `${label} : ce champ est obligatoire.` }).trim();

export const challengeDetailsSchema = z
  .object({
    title: requiredText("Titre")
      .min(3, "Le titre doit faire au moins 3 caractères.")
      .max(120, "Le titre ne peut pas dépasser 120 caractères."),
    description: z.string().trim().max(2000).default(""),
    evaluator: z.string().refine(isEvaluatorKey, {
      error: "Choisissez un type de défi dans la liste.",
    }),
    sport_family: z.enum(SPORT_FAMILIES, {
      error: "Choisissez une famille de sport.",
    }),
    difficulty: z.enum(DIFFICULTIES, {
      error: "Choisissez une difficulté.",
    }),
    points: z
      .number({ error: "Indiquez un nombre de points." })
      .int("Les points sont un nombre entier.")
      .min(1, "Un défi vaut au moins 1 point.")
      .max(1000, "Un défi ne peut pas valoir plus de 1000 points."),
    duration_scope: z.enum(["day", "multi_day"], {
      error: "Précisez si le défi tient sur une journée ou sur plusieurs.",
    }),
    duration_days: z
      .number()
      .int()
      .min(1)
      .max(30, "Une édition dure trente jours.")
      .nullable()
      .default(null),
  })
  // Mirrors the database constraint. Checked here too so the refusal is a
  // sentence in the form rather than a Postgres error nobody can read.
  .refine(
    (value) => value.duration_scope === "day" || value.duration_days !== null,
    {
      error:
        "Un défi sur plusieurs jours doit indiquer combien de jours il dure.",
      path: ["duration_days"],
    },
  );

export type ChallengeDetails = z.infer<typeof challengeDetailsSchema>;

/** French labels for the details, used when reporting their errors. */
export const DETAIL_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  evaluator: "Type de défi",
  sport_family: "Famille de sport",
  difficulty: "Difficulté",
  points: "Points",
  duration_scope: "Portée",
  duration_days: "Nombre de jours",
};
