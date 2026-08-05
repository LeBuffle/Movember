import "server-only";

import type { Activity } from "@/lib/activities/activity";
import { applyActivity } from "@/lib/challenges/completion";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where activities enter the game — the one door, whatever the source.
 *
 * Runs with the service key, like the payment webhook of story 2.4 and for
 * the same reason: it acts on nobody's behalf. `activities` has no write
 * policy for anyone at all, which is what stops a participant from handing
 * themselves a 40 km run.
 *
 * **Storing and evaluating are one step, in that order.** An activity that
 * is stored but never evaluated is a challenge silently not completed —
 * invisible until a participant writes in. Doing both here means every
 * source gets the behaviour for free: the webhook of story 3.5, the hourly
 * catch-up of story 3.6 and the simulated injection below all take the same
 * path.
 */

export type IngestReport = {
  received: number;
  /** Rows the database actually accepted — the rest were already there. */
  stored: number;
  /** Challenges completed by these activities. */
  completed: number;
  failed: number;
};

/**
 * @returns what happened, counted. Never throws: a batch of two hundred must
 *   not be lost because one activity is malformed.
 */
export async function recordActivities(
  activities: Activity[],
): Promise<IngestReport> {
  const report: IngestReport = {
    received: activities.length,
    stored: 0,
    completed: 0,
    failed: 0,
  };

  for (const activity of activities) {
    const outcome = await storeOne(activity);

    if (outcome === "failed") {
      report.failed += 1;
      continue;
    }

    if (outcome === "duplicate") continue;

    report.stored += 1;

    // Only newly stored activities are evaluated. `applyActivity` is safe to
    // replay — the completion carries its own guard (story 4.5) — but an
    // hourly catch-up passing over a whole month would otherwise re-read
    // every open challenge for every activity it has already seen.
    const completion = await applyActivity(activity);
    report.completed += completion.completed;
  }

  return report;
}

type Outcome = "stored" | "duplicate" | "failed";

async function storeOne(activity: Activity): Promise<Outcome> {
  const admin = createAdminClient();

  const { error } = await admin.from("activities").insert({
    profile_id: activity.profileId,
    provider: activity.provider,
    provider_activity_id: activity.id,
    name: activity.name,
    sport_family: activity.sportFamily,
    started_at: activity.startedAt,
    local_date: activity.localDate,
    distance_meters: Math.round(activity.distanceMeters),
    duration_seconds: Math.round(activity.durationSeconds),
    elevation_meters: Math.round(activity.elevationMeters),
  });

  if (!error) return "stored";

  // Somebody got there first — a replayed webhook, a catch-up overlapping an
  // initial import. The activity is in the game, which is all that matters.
  if (error.code === "23505") return "duplicate";

  console.error("[activités] enregistrement impossible", {
    provider: activity.provider,
    code: error.code,
  });

  return "failed";
}

/** How many activities a participant has, for the connection screen. */
export async function countActivities(profileId: string): Promise<number> {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (error) {
    console.error("[activités] comptage impossible", { code: error.code });
    return 0;
  }

  return count ?? 0;
}
