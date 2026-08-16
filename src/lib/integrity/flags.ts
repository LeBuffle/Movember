import "server-only";

import type { Activity } from "@/lib/activities/activity";
import {
  DEFAULT_THRESHOLDS,
  evaluateIntegrity,
  type Thresholds,
} from "@/lib/integrity/rules";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recording what the rules noticed (story 9.6).
 *
 * Written with the service key because the table carries **no write policy at
 * all** — for anybody. Row level security filters ROWS, not COLUMNS: whoever
 * could write `status` could dismiss their own flag, and the queue would be
 * worth nothing on the day it matters.
 *
 * **Nothing here blocks anything.** It is called after the activity has been
 * stored and after the challenges have been evaluated; it adds a line to a
 * queue and returns. A failure to record a flag must never cost somebody
 * their completed challenge, which is why it swallows its errors into the
 * server log.
 */

/** Read once per batch: a hundred activities must not mean a hundred reads. */
export async function readThresholds(): Promise<Thresholds> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("integrity_settings")
    .select(
      "max_run_speed_kmh, max_bike_speed_kmh, max_duration_hours, max_elevation_per_km",
    )
    .maybeSingle();

  if (error || !data) {
    // The defaults rather than nothing: a settings row that cannot be read
    // must not silently switch the rules off.
    if (error) {
      console.error("[intégrité] seuils illisibles, valeurs par défaut", {
        code: error.code,
      });
    }
    return DEFAULT_THRESHOLDS;
  }

  return {
    maxRunSpeedKmh: Number(data.max_run_speed_kmh),
    maxBikeSpeedKmh: Number(data.max_bike_speed_kmh),
    maxDurationHours: Number(data.max_duration_hours),
    maxElevationPerKm: Number(data.max_elevation_per_km),
  };
}

/**
 * Flags one activity, if any rule trips.
 *
 * @param activityId The stored row's identifier — not the provider's.
 * @returns how many flags were recorded. Zero is the expected answer.
 */
export async function flagActivity(
  activityId: string,
  activity: Activity,
  thresholds: Thresholds,
): Promise<number> {
  const flags = evaluateIntegrity(activity, thresholds);
  if (flags.length === 0) return 0;

  const admin = createAdminClient();

  const { error } = await admin.from("activity_flags").insert(
    flags.map((flag) => ({
      activity_id: activityId,
      profile_id: activity.profileId,
      rule: flag.rule,
      observed: flag.observed,
      threshold: flag.threshold,
      unit: flag.unit,
    })),
    // A resynchronised activity must not reopen a case somebody already
    // settled. The unique index on (activity_id, rule) is what says so; this
    // just stops the duplicate from being reported as a failure.
    { count: "exact" },
  );

  if (error) {
    // 23505 is the unique violation: the flag already exists, which is the
    // normal outcome of a resynchronisation and not a problem.
    if (error.code !== "23505") {
      console.error("[intégrité] signalement non enregistré", {
        code: error.code,
        activity: activityId,
      });
    }
    return 0;
  }

  return flags.length;
}
