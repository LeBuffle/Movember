import { z } from "zod";

import {
  EVALUATORS,
  isEvaluatorKey,
  type EvaluatorKey,
} from "@/lib/challenges/evaluators/registry";

/**
 * Validation of a challenge's configuration.
 *
 * This is the real deliverable of story 4.1, more than the tables. A `jsonb`
 * column nobody checks is a promise of a failure: a threshold typed in
 * kilometres where the code counts metres produces a challenge nobody can
 * complete, and the defect only shows at evaluation — on a November morning,
 * to four hundred people at once.
 *
 * Validated on the way in **and on the way out**. On the way out because a
 * row can be edited straight in SQL, and because a configuration written
 * months ago may predate a change to its schema. Reading an invalid
 * configuration must be an explicit refusal, not an evaluator quietly
 * behaving oddly.
 */

export type ConfigCheck =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; errors: string[] };

/**
 * Turns Zod's report into sentences a volunteer can act on.
 *
 * `config.min_distance_meters: Expected number, received string` helps
 * nobody. The field is named in French, and the message says what to do.
 */
const FIELD_LABELS: Record<string, string> = {
  min_distance_meters: "Distance minimale (en mètres)",
  min_duration_seconds: "Durée minimale (en secondes)",
  min_elevation_meters: "Dénivelé minimal (en mètres)",
  min_duration_seconds_per_day: "Durée minimale par jour (en secondes)",
  sport_types: "Sports concernés",
  window: "Fenêtre d’évaluation",
  window_days: "Fenêtre (en jours)",
  days: "Nombre de jours",
  allowed_gaps: "Jours de tolérance",
  distinct_sports: "Nombre de sports différents",
  metric: "Donnée cumulée",
  target: "Objectif",
  conditions: "Conditions",
  mode: "Mode de combinaison",
};

function humanise(issue: z.core.$ZodIssue): string {
  const path = issue.path.join(".");
  const field = FIELD_LABELS[String(issue.path[0] ?? "")] ?? path;

  // A missing field reads better as a demand than as a type error.
  if (issue.code === "invalid_type" && issue.input === undefined) {
    return `${field} : ce réglage est obligatoire.`;
  }

  return field ? `${field} : ${issue.message}` : issue.message;
}

/**
 * Checks a configuration against its evaluator's schema.
 *
 * Never throws: the caller is a form, and a form shows errors rather than
 * crashing.
 */
export function parseChallengeConfig(
  evaluator: string,
  config: unknown,
): ConfigCheck {
  if (!isEvaluatorKey(evaluator)) {
    return {
      ok: false,
      errors: [
        `Le type de défi « ${evaluator} » n’existe pas. Choisissez-en un dans la liste.`,
      ],
    };
  }

  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return {
      ok: false,
      errors: ["Les réglages du défi sont absents ou mal formés."],
    };
  }

  const result = EVALUATORS[evaluator].configSchema.safeParse(config);

  if (!result.success) {
    return { ok: false, errors: result.error.issues.map(humanise) };
  }

  return { ok: true, config: result.data as Record<string, unknown> };
}

/**
 * Same check, for the read path.
 *
 * Returns `null` on an invalid configuration rather than a half-usable
 * object. An evaluator handed a configuration it does not understand would
 * either crash or — far worse — quietly judge something else.
 */
export function readChallengeConfig(
  evaluator: string,
  config: unknown,
): Record<string, unknown> | null {
  const checked = parseChallengeConfig(evaluator, config);

  if (!checked.ok) {
    console.error("[défis] configuration invalide en base", {
      evaluator,
      errors: checked.errors,
    });
    return null;
  }

  return checked.config;
}

/** The evaluator keys, for a form's select. */
export function evaluatorOptions(): Array<{
  key: EvaluatorKey;
  label: string;
  description: string;
}> {
  return Object.values(EVALUATORS).map(({ key, label, description }) => ({
    key,
    label,
    description,
  }));
}
