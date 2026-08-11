import "server-only";

import type { Activity } from "@/lib/activities/activity";
import { applyActivity } from "@/lib/challenges/completion";
import { todayInParis } from "@/lib/challenges/daily-draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { notifyCompletions } from "@/lib/notifications/game";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Settling a fil rouge that was already earned when it was handed out.
 *
 * **A multi-day challenge is retroactive** (décision PO du 11 août) : it looks
 * back over the month rather than forward from the draw. Somebody who draws
 * "20 jours d'activité" on the 28th and has already done them has won it —
 * that is the whole point of the rule.
 *
 * But nothing would say so. The evaluation runs when an activity arrives, and
 * no activity arrives on the strength of a draw. Without this pass, the
 * challenge would sit open until their next outing — and for somebody who
 * draws one on the last day of the edition, that outing never comes.
 *
 * So the day's multi-day assignments are replayed against the participant's
 * most recent activity, once, right after the draw. Replaying is safe by
 * construction: a completion only lands on an assignment still `open`.
 *
 * **It never conditions the draw.** Same rule as the notification of story 6.5
 * AC 7: the assignment is the fact, this is a consequence. It runs after, logs
 * its own failures, and returns a report nobody is obliged to act on.
 */

export type RetroactiveReport = {
  /** Participants who received a fil rouge today. */
  examined: number;
  /** Challenges settled on the spot. */
  settled: number;
  /** Participants left out by the cap, if it was reached. */
  skipped: number;
};

/**
 * A ceiling on one pass.
 *
 * Reached only if more than five hundred people draw a fil rouge on the same
 * morning, which the catalogue makes unlikely. **Whatever it drops is
 * counted and logged** rather than silently trimmed: a cap nobody can see is
 * a cap that reads as "everything was handled".
 */
const MAX_PER_PASS = 500;

export async function settleRetroactiveAssignments(
  date = todayInParis(),
): Promise<RetroactiveReport> {
  const empty: RetroactiveReport = { examined: 0, settled: 0, skipped: 0 };
  const admin = createAdminClient();

  const { data: edition } = await admin
    .from("editions")
    .select("id, starts_on")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return empty;

  /* Only the fils rouges. A single-day challenge is judged on the day it was
     handed out, so it can never already be satisfied at the moment of the
     draw — replaying it would be a query for a foregone conclusion. */
  const { data, error } = await admin
    .from("challenge_assignments")
    .select("profile_id, challenges (duration_days)")
    .eq("edition_id", edition.id)
    .eq("assigned_for", date)
    .eq("status", "open");

  if (error) {
    console.error("[fil rouge] attributions du jour illisibles", {
      code: error.code,
    });
    return empty;
  }

  const rows = (data ?? []) as unknown as Array<{
    profile_id: string;
    challenges: { duration_days: number | null } | null;
  }>;

  const profiles = [
    ...new Set(
      rows
        .filter((row) => (row.challenges?.duration_days ?? 1) > 1)
        .map((row) => row.profile_id),
    ),
  ];

  const examined = Math.min(profiles.length, MAX_PER_PASS);
  const skipped = profiles.length - examined;

  if (skipped > 0) {
    console.error("[fil rouge] plafond atteint, participants non traités", {
      date,
      skipped,
    });
  }

  let settled = 0;

  for (const profileId of profiles.slice(0, MAX_PER_PASS)) {
    const trigger = await latestActivity(profileId, edition.starts_on, date);
    if (!trigger) continue;

    const report = await applyActivity(trigger);
    settled += report.completed;

    if (report.completions.length > 0) {
      // After the write, and unable to undo it.
      await notifyCompletions(profileId, report.completions, date);
    }
  }

  console.info("[fil rouge] rattrapage rétroactif", {
    date,
    examined,
    settled,
    skipped,
  });

  return { examined, settled, skipped };
}

/**
 * The participant's most recent activity inside the edition.
 *
 * **The most recent, not any**, and that is what makes the window as wide as
 * it can honestly be: a retroactive window ends on the day of the activity
 * being judged, so replaying an old outing would judge the challenge against
 * an old fortnight.
 *
 * Hand-typed activities are excluded here as they are everywhere else
 * (story 9.8) — using one as a trigger would judge a whole fil rouge from a
 * declaration.
 */
async function latestActivity(
  profileId: string,
  from: string,
  to: string,
): Promise<Activity | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activities")
    .select(
      "provider_activity_id, provider, name, sport_family, started_at, local_date, distance_meters, duration_seconds, elevation_meters, is_manual",
    )
    .eq("profile_id", profileId)
    .eq("is_manual", false)
    .gte("local_date", from)
    .lte("local_date", to)
    .order("local_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    provider_activity_id: string;
    provider: Activity["provider"];
    name: string;
    sport_family: Activity["sportFamily"];
    started_at: string;
    local_date: string;
    distance_meters: number;
    duration_seconds: number;
    elevation_meters: number;
    is_manual: boolean;
  };

  return {
    id: row.provider_activity_id,
    provider: row.provider,
    profileId,
    name: row.name,
    sportFamily: row.sport_family,
    startedAt: row.started_at,
    localDate: row.local_date,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    elevationMeters: row.elevation_meters,
    isManual: row.is_manual,
  };
}
