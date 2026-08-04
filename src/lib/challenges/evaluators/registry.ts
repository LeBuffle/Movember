import { z } from "zod";

import type { ConfigField } from "@/lib/challenges/fields";
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
 * **This registry drives four things at once**: the validation of a
 * challenge's configuration, the form the back-office builds for it
 * (story 4.2), the sentence shown in the preview, and — from story 4.3 — the
 * evaluation itself. Adding an evaluator means adding an entry here and
 * nothing else. That property is what story 4.7 depends on, and a test
 * enforces it: an entry whose `fields` do not cover its schema fails the
 * build.
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
 *
 * The volunteer never sees these names and never types metres: the form asks
 * for kilometres and minutes, and converts (`fields.ts`).
 * ---------------------------------------------------------------------- */

const boundedInteger = (max: number, tooLarge: string) =>
  z
    .number({ error: "Indiquez un nombre." })
    .int("Indiquez un nombre entier.")
    .positive("La valeur doit être supérieure à zéro.")
    .max(max, tooLarge);

const TOO_FAR = "Au-delà de 200 km, il s’agit presque sûrement d’une erreur.";
const TOO_LONG =
  "Au-delà de 24 heures, il s’agit presque sûrement d’une erreur.";
const TOO_HIGH = "Au-delà de 9 000 m de dénivelé, il s’agit d’une erreur.";
const TOO_MANY_DAYS = "Une édition dure trente jours.";

const sportList = z
  .array(sportFamilySchema)
  .min(1, "Choisissez au moins un sport.");

/** Over how long the challenge is judged. */
const windowSchema = z.enum(["day", "multi_day"], {
  error: "La fenêtre doit être « la journée » ou « plusieurs jours ».",
});

const sportsField: ConfigField = {
  kind: "sports",
  name: "sport_types",
  label: "Sports concernés",
  hint: "Choisissez « Tous sports » si n’importe quelle activité convient.",
};

const windowField: ConfigField = {
  kind: "choice",
  name: "window",
  label: "Fenêtre d’évaluation",
  options: [
    { value: "day", label: "Dans la journée" },
    { value: "multi_day", label: "Sur plusieurs jours" },
  ],
};

/* -------------------------------------------------------------------------
 * Configuration per evaluator
 * ---------------------------------------------------------------------- */

const distanceConfig = z.object({
  /* 200 km caps a plausible single effort. Above that, it is a typo — most
     likely someone meaning kilometres in a field that counts metres. */
  min_distance_meters: boundedInteger(200_000, TOO_FAR),
  sport_types: sportList,
  window: windowSchema.default("day"),
});

const distanceFields: ConfigField[] = [
  {
    kind: "number",
    name: "min_distance_meters",
    label: "Distance minimale",
    unit: "km",
    factor: 1000,
    hint: "En kilomètres. Écrivez 5 pour 5 km, 0,5 pour 500 m.",
  },
  sportsField,
  windowField,
];

const durationConfig = z.object({
  /* 24 hours. */
  min_duration_seconds: boundedInteger(86_400, TOO_LONG),
  sport_types: sportList,
  window: windowSchema.default("day"),
});

const durationFields: ConfigField[] = [
  {
    kind: "number",
    name: "min_duration_seconds",
    label: "Durée minimale",
    unit: "minutes",
    factor: 60,
    hint: "En minutes. Écrivez 30 pour une demi-heure.",
  },
  sportsField,
  windowField,
];

const elevationConfig = z.object({
  min_elevation_meters: boundedInteger(9_000, TOO_HIGH),
  sport_types: sportList,
  window: windowSchema.default("day"),
});

const elevationFields: ConfigField[] = [
  {
    kind: "number",
    name: "min_elevation_meters",
    label: "Dénivelé positif minimal",
    unit: "mètres",
    factor: 1,
    hint: "En mètres de montée cumulés.",
  },
  sportsField,
  windowField,
];

const streakConfig = z.object({
  /* An edition lasts thirty days. */
  days: boundedInteger(30, TOO_MANY_DAYS),
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
  min_duration_seconds_per_day: boundedInteger(86_400, TOO_LONG).optional(),
});

const streakFields: ConfigField[] = [
  {
    kind: "number",
    name: "days",
    label: "Nombre de jours",
    unit: "jours",
    factor: 1,
    hint: "Combien de jours d’affilée il faut bouger.",
  },
  sportsField,
  {
    kind: "number",
    name: "allowed_gaps",
    label: "Jours de tolérance",
    unit: "jours",
    factor: 1,
    optional: true,
    hint: "Jours que le participant peut manquer sans perdre sa série. 0 par défaut.",
  },
  {
    kind: "number",
    name: "min_duration_seconds_per_day",
    label: "Durée minimale par jour",
    unit: "minutes",
    factor: 60,
    optional: true,
    hint: "Facultatif. Sans cette valeur, n’importe quelle activité compte.",
  },
];

const multisportConfig = z.object({
  /* Three different sports in the window, say. */
  distinct_sports: boundedInteger(6, "Il n’existe que six familles de sport."),
  sport_types: sportList,
  window_days: boundedInteger(30, TOO_MANY_DAYS).default(1),
});

const multisportFields: ConfigField[] = [
  {
    kind: "number",
    name: "distinct_sports",
    label: "Nombre de sports différents",
    unit: "sports",
    factor: 1,
    hint: "Combien de sports différents il faut pratiquer.",
  },
  sportsField,
  {
    kind: "number",
    name: "window_days",
    label: "Fenêtre",
    unit: "jours",
    factor: 1,
    optional: true,
    hint: "Sur combien de jours. 1 par défaut, c’est-à-dire la journée.",
  },
];

const collectiveConfig = z.object({
  metric: z
    .enum(["distance_meters", "duration_seconds", "activity_count"], {
      error:
        "Choisissez ce qui est cumulé : distance, durée ou nombre d’activités.",
    })
    .default("distance_meters"),
  /* No upper bound here: a collective target is a sum across hundreds of
     people, and last edition's was 30 000 km. */
  target: z
    .number({ error: "Indiquez un objectif chiffré." })
    .int()
    .positive("L’objectif doit être supérieur à zéro."),
  sport_types: sportList,
});

const collectiveFields: ConfigField[] = [
  {
    kind: "choice",
    name: "metric",
    label: "Donnée cumulée",
    options: [
      { value: "distance_meters", label: "Distance parcourue" },
      { value: "duration_seconds", label: "Temps passé" },
      { value: "activity_count", label: "Nombre d’activités" },
    ],
  },
  {
    kind: "number",
    name: "target",
    label: "Objectif du groupe",
    unit: "km",
    factor: 1000,
    // The unit of a collective target depends on what is being counted. The
    // form follows the choice above rather than asking anyone to remember
    // that "1 800" meant seconds.
    unitBy: {
      field: "metric",
      units: {
        distance_meters: { unit: "km", factor: 1000 },
        duration_seconds: { unit: "heures", factor: 3600 },
        activity_count: { unit: "activités", factor: 1 },
      },
    },
    hint: "Additionné sur l’ensemble des participants.",
  },
  sportsField,
];

/* The safety valve (architecture D2): mechanics nobody anticipated, expressed
   by combining the others rather than by adding a type for every idea an
   animation team has in November.

   Each condition is checked with the real schema of the evaluator it names,
   not as a loose object. A condition nobody validates would reach the
   evaluation with anything inside it — exactly what story 4.1 set out to
   make impossible. */
const surpriseConditionSchema = z.discriminatedUnion("evaluator", [
  z.object({ evaluator: z.literal("distance"), config: distanceConfig }),
  z.object({ evaluator: z.literal("duration"), config: durationConfig }),
  z.object({ evaluator: z.literal("elevation"), config: elevationConfig }),
  z.object({ evaluator: z.literal("multisport"), config: multisportConfig }),
]);

/** The evaluators a surprise challenge may combine. All have flat settings. */
export const SURPRISE_CONDITION_KEYS = [
  "distance",
  "duration",
  "elevation",
  "multisport",
] as const;

const surpriseConfig = z.object({
  conditions: z
    .array(surpriseConditionSchema)
    .min(2, "Un défi surprise combine au moins deux conditions.")
    .max(4, "Au-delà de quatre conditions, le défi devient illisible."),
  mode: z
    .enum(["all", "any"], {
      error:
        "Précisez si toutes les conditions doivent être remplies, ou une seule.",
    })
    .default("all"),
});

const surpriseFields: ConfigField[] = [
  {
    kind: "conditions",
    name: "conditions",
    label: "Conditions combinées",
    hint: "De deux à quatre conditions, chacune réglée comme un défi simple.",
  },
  {
    kind: "choice",
    name: "mode",
    label: "Mode de combinaison",
    options: [
      { value: "all", label: "Toutes les conditions doivent être remplies" },
      { value: "any", label: "Une seule condition suffit" },
    ],
  },
];

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
   * What the back-office asks, and in which unit.
   *
   * Must cover exactly the keys of `configSchema` — tested. Without that
   * test, adding a setting to a schema would silently produce a form unable
   * to fill it, and a challenge nobody can save.
   */
  fields: ConfigField[];
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
    fields: distanceFields,
    needsHistory: false,
    isCollective: false,
  },
  duration: {
    key: "duration",
    label: "Durée",
    description: "Tenir une durée minimale d’activité.",
    configSchema: durationConfig,
    fields: durationFields,
    needsHistory: false,
    isCollective: false,
  },
  elevation: {
    key: "elevation",
    label: "Dénivelé",
    description: "Cumuler un dénivelé positif minimal.",
    configSchema: elevationConfig,
    fields: elevationFields,
    needsHistory: false,
    isCollective: false,
  },
  streak: {
    key: "streak",
    label: "Régularité",
    description:
      "Bouger plusieurs jours de suite, avec une tolérance paramétrable.",
    configSchema: streakConfig,
    fields: streakFields,
    needsHistory: true,
    isCollective: false,
  },
  multisport: {
    key: "multisport",
    label: "Multi-sports",
    description:
      "Pratiquer plusieurs sports différents dans une fenêtre donnée.",
    configSchema: multisportConfig,
    fields: multisportFields,
    needsHistory: true,
    isCollective: false,
  },
  collective: {
    key: "collective",
    label: "Objectif collectif",
    description:
      "Un objectif atteint par l’ensemble des participants, pas individuellement.",
    configSchema: collectiveConfig,
    fields: collectiveFields,
    needsHistory: true,
    isCollective: true,
  },
  surprise: {
    key: "surprise",
    label: "Surprise",
    description: "Combiner plusieurs conditions en un seul défi.",
    configSchema: surpriseConfig,
    fields: surpriseFields,
    needsHistory: true,
    isCollective: false,
  },
};

export function isEvaluatorKey(value: string): value is EvaluatorKey {
  return (EVALUATOR_KEYS as readonly string[]).includes(value);
}

/** What the back-office must ask for one evaluator. */
export function fieldsFor(evaluator: EvaluatorKey): ConfigField[] {
  return EVALUATORS[evaluator].fields;
}
