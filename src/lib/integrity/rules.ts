import type { Activity } from "@/lib/activities/activity";

/**
 * The consistency rules (story 9.6).
 *
 * **They flag, they never reject** (architecture D10). Nothing here refuses a
 * challenge, removes a point or withholds a card: each rule opens a file, and
 * a human decides.
 *
 * Pure, and deliberately so — no database, no session, no clock. That is what
 * makes them testable one by one, and it is what lets the thresholds be
 * passed in rather than read here: they live in `integrity_settings` so the
 * organisation can adjust them in November without a deployment (story 9.9).
 *
 * **Each rule records the value it saw.** "Vitesse moyenne 47 km/h en course à
 * pied" can be judged; "activité suspecte" cannot, and would make the queue
 * a place where you press a button without knowing what you are deciding.
 */

export type Thresholds = {
  maxRunSpeedKmh: number;
  maxBikeSpeedKmh: number;
  maxDurationHours: number;
  maxElevationPerKm: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  maxRunSpeedKmh: 25,
  maxBikeSpeedKmh: 60,
  maxDurationHours: 12,
  maxElevationPerKm: 300,
};

export type Flag = {
  /** Short, and in French: it is read in the queue, not in a log. */
  rule: string;
  observed: number;
  threshold: number;
  unit: string;
};

/** Average speed in km/h, or `null` when the outing says nothing about it. */
function averageSpeedKmh(activity: Activity): number | null {
  if (activity.durationSeconds <= 0) return null;
  if (activity.distanceMeters <= 0) return null;

  return activity.distanceMeters / 1000 / (activity.durationSeconds / 3600);
}

/** Rounded to one decimal: a flag is read by a human, not by a machine. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Every rule this activity trips.
 *
 * @returns an empty array for the overwhelming majority of outings. That is
 *   the expected result, and the queue being empty is the normal state.
 */
export function evaluateIntegrity(
  activity: Activity,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Flag[] {
  const flags: Flag[] = [];

  // A hand-typed outing is not flagged: it is simply not evaluated at all
  // (story 9.8). Flagging it too would fill the queue with cases where there
  // is nothing to arbitrate — the challenge was never validated.
  if (activity.isManual) return flags;

  const speed = averageSpeedKmh(activity);

  if (speed !== null && activity.sportFamily === "run") {
    if (speed > thresholds.maxRunSpeedKmh) {
      flags.push({
        rule: "Vitesse en course à pied",
        observed: round(speed),
        threshold: thresholds.maxRunSpeedKmh,
        unit: "km/h",
      });
    }
  }

  if (speed !== null && activity.sportFamily === "bike") {
    if (speed > thresholds.maxBikeSpeedKmh) {
      flags.push({
        rule: "Vitesse à vélo",
        observed: round(speed),
        threshold: thresholds.maxBikeSpeedKmh,
        unit: "km/h",
      });
    }
  }

  const hours = activity.durationSeconds / 3600;

  if (hours > thresholds.maxDurationHours) {
    flags.push({
      rule: "Durée de la sortie",
      observed: round(hours),
      threshold: thresholds.maxDurationHours,
      unit: "h",
    });
  }

  // Elevation only means something against a distance: 900 m of climb over
  // 3 km is remarkable, over 40 km it is an ordinary Sunday.
  if (activity.distanceMeters >= 1000 && activity.elevationMeters > 0) {
    const perKm = activity.elevationMeters / (activity.distanceMeters / 1000);

    if (perKm > thresholds.maxElevationPerKm) {
      flags.push({
        rule: "Dénivelé par kilomètre",
        observed: round(perKm),
        threshold: thresholds.maxElevationPerKm,
        unit: "m/km",
      });
    }
  }

  return flags;
}
