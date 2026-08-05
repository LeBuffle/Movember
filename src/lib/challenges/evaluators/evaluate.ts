import type { Activity } from "@/lib/activities/activity";
import { matchesSport, withinWindow } from "@/lib/activities/activity";
import type { EvaluatorKey } from "@/lib/challenges/evaluators/registry";

/**
 * Judging one activity against one challenge.
 *
 * **Pure functions, and that is the point of story 4.3** (AC 3). No database,
 * no network, no clock: an activity and a configuration go in, a verdict
 * comes out. Which is what makes the edge cases testable exhaustively — and
 * the edge cases are exactly what produces a participant writing in to say
 * their run did not count.
 *
 * Only `distance` is implemented here, deliberately. One type carried from
 * the catalogue to the displayed result tells us whether the model is sound;
 * the six others follow at story 4.7, once it has. An unimplemented type
 * returns an explicit refusal rather than `false` — "not judged yet" and
 * "judged and failed" are different answers, and conflating them would hand
 * out a missed challenge nobody could contest.
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
  activity: Activity;
  config: Record<string, unknown>;
  context: EvaluationContext;
};

const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : [];

/**
 * "Parcourir 5 km" — one activity reaching the threshold.
 *
 * **One activity, not a day's total**, and it is worth being explicit about
 * because both readings are defensible. Two 3 km runs do not complete a 5 km
 * challenge here. That follows the acceptance criterion, it matches what
 * "faire 5 km" means to most people, and it keeps the evaluator judging a
 * single activity — which is what lets a challenge be settled the moment an
 * activity arrives rather than at the end of the day. Summing over a day is a
 * different mechanic, and it belongs to a different evaluator.
 */
export function evaluateDistance(input: EvaluationInput): Verdict {
  const { activity, config, context } = input;

  const target = number(config.min_distance_meters);

  if (target <= 0) {
    return {
      completed: false,
      reason: "Ce défi n’a pas de distance à atteindre.",
      unsupported: true,
    };
  }

  if (!matchesSport(activity, list(config.sport_types))) {
    return {
      completed: false,
      reason: "Ce sport ne compte pas pour ce défi.",
      measured: activity.distanceMeters,
      target,
    };
  }

  const days = config.window === "multi_day" ? context.durationDays : 1;

  if (!withinWindow(activity.localDate, context.assignedFor, days)) {
    return {
      completed: false,
      reason: "Cette activité est en dehors de la période du défi.",
      measured: activity.distanceMeters,
      target,
    };
  }

  // `>=`, and the boundary is the case worth naming: a challenge asking for
  // 5 km is completed by exactly 5 000 m. Anything else would be arguing with
  // a participant over one metre, which is a fight nobody wins.
  if (activity.distanceMeters >= target) {
    return {
      completed: true,
      evidence: {
        activityIds: [activity.id],
        measured: activity.distanceMeters,
      },
    };
  }

  return {
    completed: false,
    reason: "La distance parcourue n’atteint pas encore l’objectif.",
    measured: activity.distanceMeters,
    target,
  };
}

const EVALUATORS: Partial<
  Record<EvaluatorKey, (input: EvaluationInput) => Verdict>
> = {
  distance: evaluateDistance,
};

/** Whether this type can be judged today. */
export function isEvaluable(evaluator: string): boolean {
  return evaluator in EVALUATORS;
}

export function evaluate(evaluator: string, input: EvaluationInput): Verdict {
  const judge = EVALUATORS[evaluator as EvaluatorKey];

  if (!judge) {
    return {
      completed: false,
      reason: `Le type « ${evaluator} » n’est pas encore évalué automatiquement.`,
      unsupported: true,
    };
  }

  return judge(input);
}
