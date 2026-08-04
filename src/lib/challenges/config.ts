import { z } from "zod";

import {
  EVALUATORS,
  EVALUATOR_KEYS,
  isEvaluatorKey,
  type EvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import type { ConfigField } from "@/lib/challenges/fields";

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
 * Every setting the seven evaluators know, by name.
 *
 * Built from the registry rather than kept as a second list. A label written
 * twice ends up saying two different things, and the copy nobody maintains
 * is always the one that reaches the error message.
 */
const FIELD_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = {};

  const record = (field: ConfigField) => {
    labels[field.name] ??=
      field.kind === "number"
        ? `${field.label} (en ${field.unit})`
        : field.label;
  };

  for (const key of EVALUATOR_KEYS) EVALUATORS[key].fields.forEach(record);

  return labels;
})();

/**
 * Turns Zod's report into sentences a volunteer can act on.
 *
 * `config.min_distance_meters: Expected number, received string` helps
 * nobody. The field is named in French, and the message says what to do.
 */
function humanise(issue: z.core.$ZodIssue): string {
  const path = issue.path.map(String);

  // A missing field reads better as a demand than as a type error.
  const message =
    issue.code === "invalid_type" && issue.input === undefined
      ? "ce réglage est obligatoire."
      : issue.message;

  if (path.length === 0) return message;

  const leaf = FIELD_LABELS[path[path.length - 1]];

  // Inside a surprise challenge, "Distance minimale" alone would not say
  // *which* of its two-to-four conditions is wrong.
  if (path[0] === "conditions" && path.length > 1 && leaf) {
    return `Condition ${Number(path[1]) + 1} — ${leaf} : ${message}`;
  }

  const field = FIELD_LABELS[path[0]] ?? leaf ?? path.join(".");

  return `${field} : ${message}`;
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
