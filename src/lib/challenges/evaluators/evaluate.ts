import type { Activity } from "@/lib/activities/activity";
import { matchesSport, withinWindow } from "@/lib/activities/activity";
import type { SportFamily } from "@/lib/challenges/sports";
import type { EvaluatorKey } from "@/lib/challenges/evaluators/registry";

/**
 * Judging a challenge.
 *
 * **Pure functions, all seven of them** (story 4.3 AC 3, story 4.7 AC 2). No
 * database, no network, no clock: what happened goes in, a verdict comes out.
 * Which is what makes the edge cases testable exhaustively — and the edge
 * cases are exactly what produces a participant writing in to say their run
 * did not count.
 *
 * Story 4.3 carried `distance` from the catalogue to the displayed result to
 * find out whether the model held. It did, and the proof is that the six
 * others are additions to this file and nothing else: the back-office form,
 * the draw and the display were not touched (story 4.7 AC 4).
 *
 * **What an evaluator needs, it is given.** Three of them cannot be settled
 * from a single activity — regularity, multi-sport and the collective goal —
 * and story 4.1 said so up front rather than discovering it here. They
 * receive a history, or they refuse to judge. Refusing is deliberate: "not
 * judged yet" and "judged and failed" are different answers, and conflating
 * them would hand out a missed challenge nobody could contest.
 */

export type EvaluationContext = {
  /** The day the challenge was handed out, `YYYY-MM-DD`. */
  assignedFor: string;
  /** How many days it runs. 1 for a single-day challenge. */
  durationDays: number;
};

export type Verdict =
  | {
      completed: true;
      /** What actually satisfied it, for the record and for the screen. */
      evidence: { activityIds: string[]; measured: number };
    }
  | {
      completed: false;
      /** In French, and readable: it may be shown to the participant. */
      reason: string;
      measured: number;
      target: number;
    }
  | { completed: false; reason: string; unsupported: true };

export type EvaluationInput = {
  /** The activity that triggered the evaluation. */
  activity: Activity;
  /**
   * Every activity of the participant inside the challenge's window,
   * including the trigger.
   *
   * Absent means "not available", not "none" — and an evaluator that needs it
   * refuses rather than judging on a single activity. The activity store
   * arrives with epic 3.
   */
  history?: readonly Activity[];
  /**
   * Everyone's contribution to a collective goal, already summed.
   *
   * Summed by the caller because it is a database question, and this file
   * answers none of those.
   */
  collectiveTotal?: number;
  config: Record<string, unknown>;
  context: EvaluationContext;
};

/* -------------------------------------------------------------------------
 * Reading a configuration that has already been validated
 *
 * Defensive anyway: these also run on rows read back from the database, and
 * story 4.1 is explicit that a row can be edited straight in SQL.
 * ---------------------------------------------------------------------- */

const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

const noTarget = (what: string): Verdict => ({
  completed: false,
  reason: `Ce défi n’a pas ${what}.`,
  unsupported: true,
});

const noHistory: Verdict = {
  completed: false,
  reason:
    "Ce défi se juge sur plusieurs activités, et l’historique n’est pas encore disponible.",
  unsupported: true,
};

const WRONG_SPORT = "Ce sport ne compte pas pour ce défi.";
const OUT_OF_WINDOW = "Cette activité est en dehors de la période du défi.";

/** How many days the challenge is judged over, given its window setting. */
function windowDays(
  config: Record<string, unknown>,
  context: EvaluationContext,
): number {
  return config.window === "multi_day" ? context.durationDays : 1;
}

/** The activities that count: right sport, right days. */
function eligible(
  activities: readonly Activity[],
  sports: string[],
  assignedFor: string,
  days: number,
): Activity[] {
  return activities.filter(
    (activity) =>
      matchesSport(activity, sports) &&
      withinWindow(activity.localDate, assignedFor, days),
  );
}

/* -------------------------------------------------------------------------
 * The three settled by reaching a threshold
 *
 * One outing, or several added up — the challenge says which, through its
 * `effort` setting. Both readings of "Parcourir 5 km" are defensible, and
 * the PO's decision was to settle it per challenge rather than once for the
 * whole catalogue: some challenges want the effort in one go, most want to
 * be reachable by somebody with a life.
 *
 * `single` remains the default, so a challenge written before the setting
 * existed keeps the meaning its sentence gives it.
 * ---------------------------------------------------------------------- */

function threshold(
  input: EvaluationInput,
  key: string,
  measure: (activity: Activity) => number,
  missing: string,
  shortfall: string,
): Verdict {
  const { activity, history, config, context } = input;

  const target = number(config[key]);
  if (target <= 0) return noTarget(missing);

  const sports = list(config.sport_types);
  const days = windowDays(config, context);

  if (config.effort === "cumulative") {
    if (!history) return noHistory;

    const counted = eligible(history, sports, context.assignedFor, days);
    const measured = counted.reduce((total, one) => total + measure(one), 0);

    if (measured >= target) {
      return {
        completed: true,
        evidence: {
          activityIds: counted.map((one) => one.id),
          measured,
        },
      };
    }

    // The trigger's own eligibility is not reported separately here: what the
    // participant needs to know is how far the total is, and naming a single
    // rejected outing in the middle of a running total would confuse more
    // than it explains.
    return { completed: false, reason: shortfall, measured, target };
  }

  const measured = measure(activity);

  if (!matchesSport(activity, sports)) {
    return { completed: false, reason: WRONG_SPORT, measured, target };
  }

  if (!withinWindow(activity.localDate, context.assignedFor, days)) {
    return { completed: false, reason: OUT_OF_WINDOW, measured, target };
  }

  // `>=`, and the boundary is the case worth naming: a challenge asking for
  // 5 km is completed by exactly 5 000 m. Anything else would be arguing with
  // a participant over one metre, which is a fight nobody wins.
  if (measured >= target) {
    return {
      completed: true,
      evidence: { activityIds: [activity.id], measured },
    };
  }

  return { completed: false, reason: shortfall, measured, target };
}

export const evaluateDistance = (input: EvaluationInput): Verdict =>
  threshold(
    input,
    "min_distance_meters",
    (activity) => activity.distanceMeters,
    "de distance à atteindre",
    "La distance parcourue n’atteint pas encore l’objectif.",
  );

export const evaluateDuration = (input: EvaluationInput): Verdict =>
  threshold(
    input,
    "min_duration_seconds",
    (activity) => activity.durationSeconds,
    "de durée à atteindre",
    "La durée de l’activité n’atteint pas encore l’objectif.",
  );

export const evaluateElevation = (input: EvaluationInput): Verdict =>
  threshold(
    input,
    "min_elevation_meters",
    (activity) => activity.elevationMeters,
    "de dénivelé à atteindre",
    "Le dénivelé cumulé n’atteint pas encore l’objectif.",
  );

/* -------------------------------------------------------------------------
 * The three that need more than one activity
 * ---------------------------------------------------------------------- */

/**
 * Moving several days running, with a tolerance.
 *
 * **Counted as qualifying days inside the window, not as a strict run.** With
 * a tolerance, "consecutive" stops having one obvious meaning — is a gap on
 * day three the same as one on day one? — and the generous reading is the one
 * a participant will agree with. A streak of five days with one day of
 * tolerance is therefore four qualifying days out of the five.
 *
 * Only days up to and including the triggering activity are counted, so a
 * challenge is never completed on the strength of days that have not happened
 * yet.
 */
export function evaluateStreak(input: EvaluationInput): Verdict {
  const { activity, history, config, context } = input;

  const days = number(config.days);
  if (days <= 0) return noTarget("de nombre de jours");
  if (!history) return noHistory;

  const perDay = number(config.min_duration_seconds_per_day);
  const tolerance = Math.max(0, number(config.allowed_gaps));
  const required = Math.max(1, days - tolerance);

  const qualifying = new Set(
    eligible(history, list(config.sport_types), context.assignedFor, days)
      .filter(
        (candidate) =>
          candidate.localDate <= activity.localDate &&
          (perDay === 0 || candidate.durationSeconds >= perDay),
      )
      .map((candidate) => candidate.localDate),
  );

  if (qualifying.size >= required) {
    return {
      completed: true,
      evidence: {
        activityIds: history.map((entry) => entry.id),
        measured: qualifying.size,
      },
    };
  }

  return {
    completed: false,
    reason: `Il manque des jours d’activité : ${qualifying.size} sur ${required}.`,
    measured: qualifying.size,
    target: required,
  };
}

/** Several different sports inside a window. */
export function evaluateMultisport(input: EvaluationInput): Verdict {
  const { activity, history, config, context } = input;

  const target = number(config.distinct_sports);
  if (target <= 0) return noTarget("de nombre de sports à pratiquer");
  if (!history) return noHistory;

  const days = Math.max(1, number(config.window_days) || 1);

  const families = new Set<SportFamily>(
    eligible(history, list(config.sport_types), context.assignedFor, days)
      .filter((candidate) => candidate.localDate <= activity.localDate)
      // An activity the provider could not classify tells us nothing about
      // which sport was practised, so it cannot count towards a count of
      // *different* sports.
      .filter((candidate) => candidate.sportFamily !== "any")
      .map((candidate) => candidate.sportFamily),
  );

  if (families.size >= target) {
    return {
      completed: true,
      evidence: {
        activityIds: history.map((entry) => entry.id),
        measured: families.size,
      },
    };
  }

  return {
    completed: false,
    reason: `Il manque des sports différents : ${families.size} sur ${target}.`,
    measured: families.size,
    target,
  };
}

/**
 * A goal reached by everybody together.
 *
 * The only evaluator that cannot be settled when an activity arrives: it
 * depends on what four hundred other people did. The total is computed
 * elsewhere and handed over — this file still answers no database questions.
 *
 * The evidence names no activity, and that is correct: nobody in particular
 * completed it.
 */
export function evaluateCollective(input: EvaluationInput): Verdict {
  const { config, collectiveTotal } = input;

  const target = number(config.target);
  if (target <= 0) return noTarget("d’objectif chiffré");

  if (collectiveTotal === undefined) {
    return {
      completed: false,
      reason:
        "Ce défi se juge sur le total de tous les participants, qui n’est pas encore calculé.",
      unsupported: true,
    };
  }

  if (collectiveTotal >= target) {
    return {
      completed: true,
      evidence: { activityIds: [], measured: collectiveTotal },
    };
  }

  return {
    completed: false,
    reason: "L’objectif collectif n’est pas encore atteint.",
    measured: collectiveTotal,
    target,
  };
}

/**
 * Several conditions in one challenge — the safety valve.
 *
 * Architecture D2 provided for mechanics nobody anticipated, expressed by
 * combining the others rather than by adding a type for every idea an
 * animation team has in November. Each condition is judged by **the real
 * evaluator** it names, on the same activity and the same window.
 *
 * An unjudgeable condition makes the whole challenge unjudgeable, whatever
 * the mode. Under `any` it might look tempting to settle on the conditions we
 * can judge — but a challenge declared missed because the condition that
 * would have saved it could not be evaluated is exactly the kind of verdict
 * nobody can defend.
 */
export function evaluateSurprise(input: EvaluationInput): Verdict {
  const { config } = input;

  const conditions = Array.isArray(config.conditions) ? config.conditions : [];

  if (conditions.length === 0) return noTarget("de conditions à remplir");

  const mode = config.mode === "any" ? "any" : "all";
  const verdicts: Verdict[] = [];

  for (const entry of conditions) {
    const { evaluator, config: inner } = (entry ?? {}) as {
      evaluator?: unknown;
      config?: unknown;
    };

    if (typeof evaluator !== "string" || !inner || typeof inner !== "object") {
      return noTarget("de conditions exploitables");
    }

    const verdict = evaluate(evaluator, {
      ...input,
      config: inner as Record<string, unknown>,
    });

    if (!verdict.completed && "unsupported" in verdict) return verdict;

    verdicts.push(verdict);
  }

  const met = verdicts.filter((verdict) => verdict.completed);
  const enough =
    mode === "any" ? met.length >= 1 : met.length === verdicts.length;

  if (enough) {
    return {
      completed: true,
      evidence: {
        activityIds: [
          ...new Set(
            met.flatMap((verdict) =>
              verdict.completed ? verdict.evidence.activityIds : [],
            ),
          ),
        ],
        measured: met.length,
      },
    };
  }

  return {
    completed: false,
    reason:
      mode === "any"
        ? "Aucune des conditions n’est encore remplie."
        : `Conditions remplies : ${met.length} sur ${verdicts.length}.`,
    measured: met.length,
    target: mode === "any" ? 1 : verdicts.length,
  };
}

/* -------------------------------------------------------------------------
 * The registry of judges
 * ---------------------------------------------------------------------- */

const EVALUATORS: Record<EvaluatorKey, (input: EvaluationInput) => Verdict> = {
  distance: evaluateDistance,
  duration: evaluateDuration,
  elevation: evaluateElevation,
  streak: evaluateStreak,
  multisport: evaluateMultisport,
  collective: evaluateCollective,
  surprise: evaluateSurprise,
};

/** Whether this type can be judged at all. */
export function isEvaluable(evaluator: string): boolean {
  return evaluator in EVALUATORS;
}

export function evaluate(evaluator: string, input: EvaluationInput): Verdict {
  const judge = EVALUATORS[evaluator as EvaluatorKey];

  if (!judge) {
    return {
      completed: false,
      reason: `Le type « ${evaluator} » n’existe pas.`,
      unsupported: true,
    };
  }

  return judge(input);
}
