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

/* -------------------------------------------------------------------------
 * Les plafonds dépendent de la façon d'atteindre l'objectif
 *
 * **Un seuil est absurde ou raisonnable selon qu'il se joue en une sortie ou
 * sur un mois.** 200 km bornent un effort unique plausible : au-delà, c'est
 * presque toujours quelqu'un qui a tapé des kilomètres dans un champ qui
 * compte des mètres. Mais 500 km cumulés sur vingt-cinq jours, c'est vingt
 * kilomètres par jour — un défi de fil rouge parfaitement ordinaire, et
 * exactement ce que le PO a demandé.
 *
 * Un plafond unique se serait donc trompé dans un sens ou dans l'autre : soit
 * il laissait passer la faute de frappe, soit il interdisait le défi. Deux
 * plafonds, choisis par le réglage `effort`, ne se trompent dans aucun des
 * deux.
 * ---------------------------------------------------------------------- */

/** En une seule sortie. Au-delà, c'est une erreur de saisie. */
const SINGLE_MAX_DISTANCE = 200_000;
const SINGLE_MAX_DURATION = 86_400;
const SINGLE_MAX_ELEVATION = 9_000;

/** Cumulé sur la fenêtre du défi. Généreux, et toujours borné. */
const CUMULATIVE_MAX_DISTANCE = 2_000_000;
const CUMULATIVE_MAX_DURATION = 720_000;
const CUMULATIVE_MAX_ELEVATION = 50_000;

const TOO_FAR = "Au-delà de 2 000 km, il s’agit presque sûrement d’une erreur.";
const TOO_FAR_SINGLE =
  "Au-delà de 200 km en une seule sortie, il s’agit presque sûrement d’une erreur. Pour un objectif plus grand, choisissez « en cumulant plusieurs sorties ».";
const TOO_LONG =
  "Au-delà de 200 heures, il s’agit presque sûrement d’une erreur.";
const TOO_LONG_SINGLE =
  "Au-delà de 24 heures en une seule sortie, il s’agit presque sûrement d’une erreur. Pour un objectif plus grand, choisissez « en cumulant plusieurs sorties ».";
const TOO_HIGH = "Au-delà de 50 000 m de dénivelé, il s’agit d’une erreur.";
const TOO_HIGH_SINGLE =
  "Au-delà de 9 000 m de dénivelé en une seule sortie, il s’agit d’une erreur. Pour un objectif plus grand, choisissez « en cumulant plusieurs sorties ».";
const TOO_MANY_DAYS = "Une édition dure trente jours.";

/**
 * Le second plafond, celui qui ne s'applique qu'à l'effort unique.
 *
 * Posé sur l'objet plutôt que sur le champ, parce qu'il dépend d'un autre
 * champ. Zod garde la forme de l'objet à travers un `refine`, donc le
 * formulaire du back-office continue d'être piloté par le registre.
 */
const cappedForSingleEffort =
  (key: string, max: number) => (config: Record<string, unknown>) =>
    config.effort === "cumulative" || Number(config[key]) <= max;

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

/**
 * One outing, or several added up.
 *
 * The two readings of "Parcourir 5 km" are both defensible — one 5 km run,
 * or two 2,5 km walks in the same day — and the PO's decision was to settle
 * it **per challenge** rather than once for the whole catalogue. Some
 * challenges want the effort in one go; most want to be reachable by
 * somebody with a life.
 *
 * `single` is the default because it is what the sentence says on its face,
 * and because a challenge written before this setting existed must not
 * change meaning. The preview sentence names the choice either way, so the
 * author sees which one they got.
 */
const effortSchema = z.enum(["single", "cumulative"], {
  error: "L’effort doit être « en une fois » ou « cumulé ».",
});

const effortField: ConfigField = {
  kind: "choice",
  name: "effort",
  label: "Comment l’atteindre",
  options: [
    { value: "single", label: "En une seule sortie" },
    { value: "cumulative", label: "En cumulant plusieurs sorties" },
  ],
  hint: "« En cumulant » additionne toutes les sorties de la fenêtre. Deux fois 2,5 km valent alors 5 km.",
};

/* -------------------------------------------------------------------------
 * Configuration per evaluator
 * ---------------------------------------------------------------------- */

const distanceConfig = z
  .object({
    min_distance_meters: boundedInteger(CUMULATIVE_MAX_DISTANCE, TOO_FAR),
    sport_types: sportList,
    window: windowSchema.default("day"),
    effort: effortSchema.default("single"),
  })
  .refine(cappedForSingleEffort("min_distance_meters", SINGLE_MAX_DISTANCE), {
    error: TOO_FAR_SINGLE,
    path: ["min_distance_meters"],
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
  effortField,
];

const durationConfig = z
  .object({
    min_duration_seconds: boundedInteger(CUMULATIVE_MAX_DURATION, TOO_LONG),
    sport_types: sportList,
    window: windowSchema.default("day"),
    effort: effortSchema.default("single"),
  })
  .refine(cappedForSingleEffort("min_duration_seconds", SINGLE_MAX_DURATION), {
    error: TOO_LONG_SINGLE,
    path: ["min_duration_seconds"],
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
  effortField,
];

const elevationConfig = z
  .object({
    min_elevation_meters: boundedInteger(CUMULATIVE_MAX_ELEVATION, TOO_HIGH),
    sport_types: sportList,
    window: windowSchema.default("day"),
    effort: effortSchema.default("single"),
  })
  .refine(cappedForSingleEffort("min_elevation_meters", SINGLE_MAX_ELEVATION), {
    error: TOO_HIGH_SINGLE,
    path: ["min_elevation_meters"],
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
  effortField,
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
   *
   * A predicate rather than a flag, because since the `effort` setting the
   * answer depends on the challenge and not only on its type: the same
   * distance challenge needs one activity when it asks for a single outing,
   * and the whole window when it adds them up.
   */
  needsHistory: (config: Record<string, unknown>) => boolean;
  /**
   * Whether it depends on everyone's activities rather than one person's.
   * `collective` cannot be judged when an activity arrives; it is computed
   * periodically.
   */
  isCollective: boolean;
};

/** Reads the `effort` setting, whatever else the configuration holds. */
const isCumulative = (config: Record<string, unknown>): boolean =>
  config.effort === "cumulative";

const always = (): boolean => true;

export const EVALUATORS: Record<EvaluatorKey, EvaluatorDefinition> = {
  distance: {
    key: "distance",
    label: "Distance",
    description: "Parcourir une distance minimale, sur un ou plusieurs sports.",
    configSchema: distanceConfig,
    fields: distanceFields,
    needsHistory: isCumulative,
    isCollective: false,
  },
  duration: {
    key: "duration",
    label: "Durée",
    description: "Tenir une durée minimale d’activité.",
    configSchema: durationConfig,
    fields: durationFields,
    needsHistory: isCumulative,
    isCollective: false,
  },
  elevation: {
    key: "elevation",
    label: "Dénivelé",
    description: "Cumuler un dénivelé positif minimal.",
    configSchema: elevationConfig,
    fields: elevationFields,
    needsHistory: isCumulative,
    isCollective: false,
  },
  streak: {
    key: "streak",
    label: "Régularité",
    description:
      "Bouger plusieurs jours de suite, avec une tolérance paramétrable.",
    configSchema: streakConfig,
    fields: streakFields,
    needsHistory: always,
    isCollective: false,
  },
  multisport: {
    key: "multisport",
    label: "Multi-sports",
    description:
      "Pratiquer plusieurs sports différents dans une fenêtre donnée.",
    configSchema: multisportConfig,
    fields: multisportFields,
    needsHistory: always,
    isCollective: false,
  },
  collective: {
    key: "collective",
    label: "Objectif collectif",
    description:
      "Un objectif atteint par l’ensemble des participants, pas individuellement.",
    configSchema: collectiveConfig,
    fields: collectiveFields,
    needsHistory: always,
    isCollective: true,
  },
  surprise: {
    key: "surprise",
    label: "Surprise",
    description: "Combiner plusieurs conditions en un seul défi.",
    configSchema: surpriseConfig,
    fields: surpriseFields,
    needsHistory: always,
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
