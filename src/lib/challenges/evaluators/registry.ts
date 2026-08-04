import { z } from "zod";

import { sportFamilySchema } from "@/lib/challenges/sports";

/**
 * The catalogue of evaluators — the one piece of the challenge engine that
 * is code rather than data.
 *
 * A challenge is a row in the database: it names an evaluator and hands it
 * parameters (architecture D2, NFR18). Creating "5 km de course aujourd'hui"
 * is filling a form, not writing code and deploying. What this file provides
 * is the seven mechanics those rows can choose from.
 *
 * **This registry drives three things at once**: the validation of a
 * challenge's configuration, the form the back-office builds for it
 * (story 4.2), and — from story 4.3 — the evaluation itself. Adding an
 * evaluator means adding an entry here and nothing else. That property is
 * what story 4.7 depends on, and it is worth protecting.
 *
 * The evaluation functions are NOT here yet. Story 4.3 takes one type all
 * the way through before the other six are written, so that a flaw in the
 * model is found on one type rather than on seven.
 */

/* -------------------------------------------------------------------------
 * Building blocks
 *
 * Shared so that "a distance" means the same thing everywhere. The units are
 * in the field names on purpose: `min_distance` invites someone to type 5
 * meaning kilometres, and produces a challenge nobody can fail. This is the
 * single most likely mistake in the whole catalogue.
 * ---------------------------------------------------------------------- */

const positiveInteger = (max: number, unit: string) =>
  z
    .number({ error: `Indiquez un nombre (${unit}).` })
    .int(`Indiquez un nombre entier (${unit}).`)
    .positive(`La valeur doit être supérieure à zéro (${unit}).`)
    .max(max, `La valeur dépasse le maximum autorisé (${max} ${unit}).`);

const sportList = z
  .array(sportFamilySchema)
  .min(1, "Choisissez au moins un sport.");

/** Over how long the challenge is judged. */
const windowSchema = z.enum(["day", "multi_day"], {
  error: "La fenêtre doit être « la journée » ou « plusieurs jours ».",
});

/* -------------------------------------------------------------------------
 * Configuration per evaluator
 * ---------------------------------------------------------------------- */

const distanceConfig = z.object({
  /* 200 km caps a plausible single effort. Above that, it is a typo — most
     likely someone meaning kilometres in a field that counts metres. */
  min_distance_meters: positiveInteger(200_000, "mètres"),
  sport_types: sportList,
  window: windowSchema.default("day"),
});

const durationConfig = z.object({
  /* 24 hours. */
  min_duration_seconds: positiveInteger(86_400, "secondes"),
  sport_types: sportList,
  window: windowSchema.default("day"),
});

const elevationConfig = z.object({
  min_elevation_meters: positiveInteger(9_000, "mètres"),
  sport_types: sportList,
  window: windowSchema.default("day"),
});

const streakConfig = z.object({
  /* An edition lasts thirty days. */
  days: positiveInteger(30, "jours"),
  sport_types: sportList,
  /* Miss a day without losing everything. A streak with no tolerance is a
     streak that ends on day three for most people, and stops motivating
     anyone the moment it does. */
  allowed_gaps: z
    .number()
    .int()
    .min(0)
    .max(
      7,
      "Au-delà de 7 jours de tolérance, la régularité ne veut plus dire grand-chose.",
    )
    .default(0),
  min_duration_seconds_per_day: positiveInteger(86_400, "secondes").optional(),
});

const multisportConfig = z.object({
  /* Three different sports in the window, say. */
  distinct_sports: positiveInteger(6, "sports"),
  sport_types: sportList,
  window_days: positiveInteger(30, "jours").default(1),
});

const collectiveConfig = z.object({
  metric: z.enum(["distance_meters", "duration_seconds", "activity_count"], {
    error:
      "Choisissez ce qui est cumulé : distance, durée ou nombre d’activités.",
  }),
  /* No upper bound in metres here: a collective target is a sum across
     hundreds of people, and last edition's was 30 000 km. */
  target: z
    .number({ error: "Indiquez un objectif chiffré." })
    .int()
    .positive("L’objectif doit être supérieur à zéro."),
  sport_types: sportList,
});

const surpriseConfig = z.object({
  /* The safety valve (architecture D2): mechanics nobody anticipated,
     expressed by combining the others rather than by adding a type for every
     idea an animation team has in November. */
  conditions: z
    .array(
      z.object({
        evaluator: z.enum(["distance", "duration", "elevation", "multisport"], {
          error: "Ce type ne peut pas entrer dans un défi surprise.",
        }),
        config: z.record(z.string(), z.unknown()),
      }),
    )
    .min(2, "Un défi surprise combine au moins deux conditions.")
    .max(4, "Au-delà de quatre conditions, le défi devient illisible."),
  mode: z
    .enum(["all", "any"], {
      error:
        "Précisez si toutes les conditions doivent être remplies, ou une seule.",
    })
    .default("all"),
});

/* -------------------------------------------------------------------------
 * The registry
 * ---------------------------------------------------------------------- */

export const EVALUATOR_KEYS = [
  "distance",
  "duration",
  "elevation",
  "streak",
  "multisport",
  "collective",
  "surprise",
] as const;

export type EvaluatorKey = (typeof EVALUATOR_KEYS)[number];

export type EvaluatorDefinition = {
  key: EvaluatorKey;
  /** Shown in the back-office. In the words a volunteer would use. */
  label: string;
  description: string;
  configSchema: z.ZodType;
  /**
   * Whether judging it needs more than one activity.
   *
   * Declared here rather than discovered later: `streak` and `multisport`
   * look at a set of activities, not at the one that just arrived. Story 4.3
   * has to know that before designing the evaluation signature, or story 4.7
   * ends up rewriting it.
   */
  needsHistory: boolean;
  /**
   * Whether it depends on everyone's activities rather than one person's.
   * `collective` cannot be judged when an activity arrives; it is computed
   * periodically.
   */
  isCollective: boolean;
};

export const EVALUATORS: Record<EvaluatorKey, EvaluatorDefinition> = {
  distance: {
    key: "distance",
    label: "Distance",
    description: "Parcourir une distance minimale, sur un ou plusieurs sports.",
    configSchema: distanceConfig,
    needsHistory: false,
    isCollective: false,
  },
  duration: {
    key: "duration",
    label: "Durée",
    description: "Tenir une durée minimale d’activité.",
    configSchema: durationConfig,
    needsHistory: false,
    isCollective: false,
  },
  elevation: {
    key: "elevation",
    label: "Dénivelé",
    description: "Cumuler un dénivelé positif minimal.",
    configSchema: elevationConfig,
    needsHistory: false,
    isCollective: false,
  },
  streak: {
    key: "streak",
    label: "Régularité",
    description:
      "Bouger plusieurs jours de suite, avec une tolérance paramétrable.",
    configSchema: streakConfig,
    needsHistory: true,
    isCollective: false,
  },
  multisport: {
    key: "multisport",
    label: "Multi-sports",
    description:
      "Pratiquer plusieurs sports différents dans une fenêtre donnée.",
    configSchema: multisportConfig,
    needsHistory: true,
    isCollective: false,
  },
  collective: {
    key: "collective",
    label: "Objectif collectif",
    description:
      "Un objectif atteint par l’ensemble des participants, pas individuellement.",
    configSchema: collectiveConfig,
    needsHistory: true,
    isCollective: true,
  },
  surprise: {
    key: "surprise",
    label: "Surprise",
    description: "Combiner plusieurs conditions en un seul défi.",
    configSchema: surpriseConfig,
    needsHistory: true,
    isCollective: false,
  },
};

export function isEvaluatorKey(value: string): value is EvaluatorKey {
  return (EVALUATOR_KEYS as readonly string[]).includes(value);
}
