import { SPORT_FAMILY_LABELS, type SportFamily } from "@/lib/challenges/sports";

/**
 * A sporting activity, as the rest of the application sees it.
 *
 * **Normalised on the way in, never on the way out.** Strava reports dozens
 * of activity types and its own units; whatever else arrives later — Garmin,
 * a manual entry, a fixture in a test — is turned into this shape at the
 * border. Everything downstream then works on one vocabulary, and an
 * evaluator never has to know that `VirtualRun` exists.
 *
 * That border does not exist yet: epic 3 builds it. What exists here is the
 * shape it will produce, and a set of made-up activities that already has it
 * (story 4.3 AC 5).
 */

export type ActivityProvider = "strava" | "manual" | "simulated";

export type Activity = {
  /** The provider's own identifier. Unique per provider, not globally. */
  id: string;
  provider: ActivityProvider;
  profileId: string;

  /** What the participant would call it. Shown, never used to decide. */
  name: string;

  sportFamily: SportFamily;

  /** When it started, as the provider recorded it. */
  startedAt: string;

  /**
   * The calendar day it counts for, `YYYY-MM-DD`.
   *
   * Kept separately rather than derived from `startedAt` at each use. A run
   * that starts at 23:40 belongs to that day whatever timezone the server
   * happens to be in — and deriving it later, on a machine set to UTC, is
   * how a Sunday-evening run ends up validating Monday's challenge.
   */
  localDate: string;

  distanceMeters: number;
  durationSeconds: number;
  elevationMeters: number;
};

/**
 * Strava's vocabulary, reduced to ours.
 *
 * Deliberately coarse (story 4.1): a challenge author has no business
 * choosing between `Run`, `TrailRun` and `VirtualRun`. Anything unrecognised
 * becomes `any` rather than being dropped — an activity nobody can classify
 * is still an activity, and losing it silently would be worse than counting
 * it towards an "all sports" challenge.
 */
const STRAVA_FAMILIES: Record<string, SportFamily> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Treadmill: "run",
  Ride: "bike",
  VirtualRide: "bike",
  MountainBikeRide: "bike",
  GravelRide: "bike",
  EBikeRide: "bike",
  Swim: "swim",
  Walk: "walk",
  Hike: "walk",
  WeightTraining: "strength",
  Workout: "strength",
  Crossfit: "strength",
};

export function sportFamilyFromProvider(type: string): SportFamily {
  return STRAVA_FAMILIES[type] ?? "any";
}

/** Whether an activity's sport is one the challenge accepts. */
export function matchesSport(
  activity: Activity,
  accepted: readonly string[],
): boolean {
  // `any` on the challenge side means every sport counts. `any` on the
  // activity side means we could not classify it — and an unclassified
  // activity must not silently satisfy a challenge that named its sports.
  if (accepted.includes("any")) return true;

  return accepted.includes(activity.sportFamily);
}

/**
 * Whether an activity falls inside the window a challenge is judged over.
 *
 * Compared as strings, which works because the format is `YYYY-MM-DD` and is
 * therefore ordered lexically. Building `Date` objects here would drag the
 * server's timezone into a decision that is purely about calendar days.
 */
export function withinWindow(
  activityDate: string,
  assignedFor: string,
  durationDays: number,
): boolean {
  if (activityDate < assignedFor) return false;

  const days =
    Number.isInteger(durationDays) && durationDays > 0 ? durationDays : 1;

  return activityDate <= addDays(assignedFor, days - 1);
}

/** `2026-11-30` + 1 day = `2026-12-01`. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);

  // Built at midday UTC so a daylight-saving shift cannot move the date.
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/** For a sentence shown to a participant: "Sortie vélo — 24,3 km". */
export function describeActivity(activity: Activity): string {
  const kilometres = activity.distanceMeters / 1000;
  const distance =
    activity.distanceMeters >= 1000
      ? `${Number(kilometres.toFixed(2)).toString().replace(".", ",")} km`
      : `${activity.distanceMeters} m`;

  return `${SPORT_FAMILY_LABELS[activity.sportFamily]} — ${distance}`;
}
