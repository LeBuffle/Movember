import { formatDistance, formatDuration } from "@/lib/challenges/describe";

/**
 * How far along a challenge is — "3,2 km sur 5 km".
 *
 * Shown **only when it means something** (story 4.6 AC 3). A bar that always
 * reads zero teaches a participant to ignore it, and a percentage on a
 * challenge that has no measurable middle — a multi-sport challenge is either
 * two sports or three, never 2,4 — would be an invention.
 *
 * So the goal is always named, and the achieved figure appears when it is
 * known. Today that is at completion; when the activity history of epic 3
 * exists, it will be known while the challenge is still open, and nothing
 * here changes.
 *
 * Pure, and in the same units the participant was shown when the challenge
 * was written: metres become kilometres, seconds become minutes.
 */

export type Progress = {
  /** The goal, in words: "5 km", "30 minutes", "3 sports". */
  target: string;
  targetValue: number;
  /** What has been achieved, when known. */
  measured: string | null;
  /** Between 0 and 1, capped. `null` when nothing has been measured. */
  ratio: number | null;
};

const plural = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

const METRES = (value: number) => `${value} m`;

type Reader = {
  key: string;
  format: (value: number) => string;
};

/**
 * Where each type keeps its goal, and how that figure reads.
 *
 * One entry per evaluator, deliberately explicit rather than derived from the
 * registry's field descriptors: the *first* number in a configuration is not
 * always the one a participant is chasing.
 */
const READERS: Record<string, Reader> = {
  distance: { key: "min_distance_meters", format: formatDistance },
  duration: { key: "min_duration_seconds", format: formatDuration },
  elevation: { key: "min_elevation_meters", format: METRES },
  streak: { key: "days", format: (value) => plural(value, "jour") },
  multisport: {
    key: "distinct_sports",
    format: (value) => plural(value, "sport"),
  },
  surprise: {
    key: "__conditions",
    format: (value) => plural(value, "condition"),
  },
};

const COLLECTIVE_FORMATS: Record<string, (value: number) => string> = {
  distance_meters: formatDistance,
  duration_seconds: formatDuration,
  activity_count: (value) => plural(value, "activité"),
};

/**
 * @param measured what has actually been done, when known. `null` before the
 *   activity history exists, and before anything has happened.
 */
export function challengeProgress(
  evaluator: string,
  config: Record<string, unknown>,
  measured: number | null,
): Progress | null {
  const { targetValue, format } = readTarget(evaluator, config);

  if (targetValue === null) return null;

  return {
    target: format(targetValue),
    targetValue,
    measured: measured === null ? null : format(measured),
    ratio:
      measured === null || targetValue <= 0
        ? null
        : Math.min(1, Math.max(0, measured / targetValue)),
  };
}

function readTarget(
  evaluator: string,
  config: Record<string, unknown>,
): { targetValue: number | null; format: (value: number) => string } {
  if (evaluator === "collective") {
    const format =
      COLLECTIVE_FORMATS[String(config.metric)] ?? ((value) => String(value));

    return { targetValue: asNumber(config.target), format };
  }

  const reader = READERS[evaluator];
  if (!reader) return { targetValue: null, format: String };

  if (reader.key === "__conditions") {
    const count = Array.isArray(config.conditions)
      ? config.conditions.length
      : null;

    return { targetValue: count, format: reader.format };
  }

  return { targetValue: asNumber(config[reader.key]), format: reader.format };
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * What a participant has earned so far.
 *
 * Points, not challenges completed (architecture D14). Counting challenges
 * would favour whoever drew the easiest ones — and the challenges differ from
 * one participant to the next, so the unfairness would be visible.
 *
 * Counted from what was awarded at completion, never from the catalogue's
 * current value: a challenge repriced in mid-edition must not change a score
 * somebody already saw.
 */
export function totalPoints(
  challenges: ReadonlyArray<{
    status: string;
    points: number;
    pointsAwarded: number | null;
  }>,
): number {
  return challenges
    .filter((challenge) => challenge.status === "completed")
    .reduce(
      (total, challenge) =>
        total + (challenge.pointsAwarded ?? challenge.points),
      0,
    );
}
