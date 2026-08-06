import "server-only";

import { addDays, type Activity } from "@/lib/activities/activity";
import { readChallengeConfig } from "@/lib/challenges/config";
import { evaluate, type Verdict } from "@/lib/challenges/evaluators/evaluate";
import {
  EVALUATORS,
  type EvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Turning a verdict into a completed challenge.
 *
 * The thin layer between the pure evaluators and the database — thin on
 * purpose. Everything that decides anything lives in
 * `evaluators/evaluate.ts` and can be tested without a database; what is
 * here is the writing down.
 *
 * Runs with the service key, like the webhook of story 2.4 and for the same
 * reason: it acts on nobody's behalf. `challenge_assignments` has no write
 * policy for anyone, which is what stops a participant from awarding
 * themselves the month.
 */

/**
 * How far back an activity can reach.
 *
 * A challenge's window never exceeds thirty days — the database says so, and
 * an edition lasts a month. So an activity can only ever satisfy a challenge
 * handed out within the previous twenty-nine days, and looking further back
 * is reading rows that cannot possibly match.
 *
 * The bound that matters most is the other one, and it is free: an activity
 * cannot satisfy a challenge handed out *after* it happened.
 *
 * Without both, every activity would re-read every challenge since the first
 * of November, and the thirtieth day would cost thirty times the first
 * (story 4.5 AC 5).
 */
const MAX_WINDOW_DAYS = 30;

/** A hard stop, well above the thirty an edition can produce. */
const MAX_OPEN_ASSIGNMENTS = 60;

/** Two months of activity for one person. Generous, and still bounded. */
const MAX_HISTORY = 300;

export type CompletionReport = {
  examined: number;
  completed: number;
  /** Assignments the evaluator could not judge yet (story 4.7). */
  unsupported: number;
};

type OpenAssignment = {
  id: string;
  assigned_for: string;
  challenge: {
    evaluator: string;
    config: Record<string, unknown>;
    points: number;
    duration_days: number | null;
  };
};

/**
 * Applies one activity to every challenge the participant still has open.
 *
 * **Only `open` assignments are looked at**, and the update itself carries
 * the same condition (AC 6). A challenge already completed is not completed
 * again by a second activity — not because the code remembers, but because
 * the query cannot see it and the write cannot land.
 *
 * **Every open challenge is offered the activity, not just the day's**
 * (story 4.5, PRD D3). Which is the point: somebody who has not run for three
 * days can go out on Saturday and settle three challenges at once. A game
 * that demanded one session per challenge would not be tenable for people
 * with a life, and that is an explicit request from the PO rather than a
 * design flourish.
 *
 * **A missed challenge is never closed.** Nothing in the application marks a
 * challenge `missed` while the edition runs, and that is deliberate: it stays
 * open, it blocks nothing, and a later activity can still complete it. The
 * `missed` state exists for the end of the month, not for the morning after.
 */
export async function applyActivity(
  activity: Activity,
): Promise<CompletionReport> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("challenge_assignments")
    .select(
      "id, assigned_for, challenges (evaluator, config, points, duration_days)",
    )
    .eq("profile_id", activity.profileId)
    .eq("status", "open")
    // An activity cannot satisfy a challenge handed out after it happened.
    .lte("assigned_for", activity.localDate)
    .gte("assigned_for", addDays(activity.localDate, -(MAX_WINDOW_DAYS - 1)))
    .limit(MAX_OPEN_ASSIGNMENTS);

  if (error) {
    console.error("[défis] défis en cours illisibles", {
      profile: activity.profileId,
      code: error.code,
    });
    return { examined: 0, completed: 0, unsupported: 0 };
  }

  const assignments = (data ?? []) as unknown as Array<
    Omit<OpenAssignment, "challenge"> & {
      challenges: OpenAssignment["challenge"] | null;
    }
  >;

  let completed = 0;
  let unsupported = 0;

  // Loaded once, lazily, and shared by every assignment that needs it.
  //
  // Before story 3.1 there was no activity store at all, so the evaluators
  // that judge on several activities — regularity, multi-sport, and now a
  // cumulative distance — always refused. The table exists now, so they can
  // actually be judged; the laziness is what keeps the common case (one
  // activity, one threshold) at a single query.
  let history: Activity[] | undefined;
  let historyLoaded = false;

  for (const assignment of assignments) {
    const challenge = assignment.challenges;
    if (!challenge) continue;

    // Re-validated on the way out (story 4.1). A configuration edited
    // straight in SQL, or written before a schema change, must stop the
    // evaluation rather than be judged on whatever it happens to contain.
    const config = readChallengeConfig(challenge.evaluator, challenge.config);

    if (!config) {
      unsupported += 1;
      continue;
    }

    const definition = EVALUATORS[challenge.evaluator as EvaluatorKey];

    if (definition?.needsHistory(config) && !historyLoaded) {
      history = await readHistory(activity);
      historyLoaded = true;
    }

    const verdict = evaluate(challenge.evaluator, {
      activity,
      history,
      config,
      context: {
        assignedFor: assignment.assigned_for,
        durationDays: challenge.duration_days ?? 1,
      },
    });

    if (!verdict.completed) {
      if ("unsupported" in verdict) unsupported += 1;
      continue;
    }

    const written = await recordCompletion(
      assignment.id,
      challenge.points,
      verdict,
    );

    if (written) completed += 1;
  }

  return { examined: assignments.length, completed, unsupported };
}

/**
 * The participant's activities around the one that just arrived.
 *
 * A band rather than "everything": an edition lasts thirty days and a
 * challenge's window never exceeds that, so nothing outside this range can
 * belong to a window that contains the trigger. Reading the whole history
 * would grow with every edition for no gain.
 *
 * The band reaches **forward** as well as back, which is not obvious: an
 * initial import (story 3.6) can bring activities in any order, so a
 * challenge assigned yesterday may already have activities dated tomorrow.
 *
 * @returns `undefined` when the read fails, and an array — possibly empty —
 *   when it succeeds. The distinction is exactly what the evaluators read:
 *   absent means "not available" and they refuse to judge, empty means
 *   "nothing yet" and they judge and find nothing. A database error must
 *   never be turned into a challenge marked as not achieved.
 */
async function readHistory(
  activity: Activity,
): Promise<Activity[] | undefined> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activities")
    .select(
      "provider_activity_id, provider, name, sport_family, started_at, local_date, distance_meters, duration_seconds, elevation_meters",
    )
    .eq("profile_id", activity.profileId)
    .gte("local_date", addDays(activity.localDate, -(MAX_WINDOW_DAYS - 1)))
    .lte("local_date", addDays(activity.localDate, MAX_WINDOW_DAYS - 1))
    .order("local_date", { ascending: true })
    .limit(MAX_HISTORY);

  if (error) {
    console.error("[défis] historique d’activités illisible", {
      profile: activity.profileId,
      code: error.code,
    });
    return undefined;
  }

  type Row = {
    provider_activity_id: string;
    provider: Activity["provider"];
    name: string;
    sport_family: Activity["sportFamily"];
    started_at: string;
    local_date: string;
    distance_meters: number;
    duration_seconds: number;
    elevation_meters: number;
  };

  return (data as Row[]).map((row) => ({
    id: row.provider_activity_id,
    provider: row.provider,
    profileId: activity.profileId,
    name: row.name,
    sportFamily: row.sport_family,
    startedAt: row.started_at,
    localDate: row.local_date,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    elevationMeters: row.elevation_meters,
  }));
}

/**
 * @returns whether this call is the one that completed it.
 *
 * `false` covers two very different things — it was already done, or the
 * write failed — and the caller only needs the count. Both are logged
 * distinctly, which is where the difference matters.
 */
async function recordCompletion(
  assignmentId: string,
  points: number,
  verdict: Extract<Verdict, { completed: true }>,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("challenge_assignments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      // A copy of the points, taken now: the catalogue's value can be
      // corrected mid-edition and what is earned must not move (D12).
      points_awarded: points,
      evidence: {
        activity_ids: verdict.evidence.activityIds,
        measured: verdict.evidence.measured,
      },
    })
    .eq("id", assignmentId)
    // The guard that makes a second activity harmless, and the only one that
    // holds when two arrive at the same moment.
    .eq("status", "open")
    .select("id");

  if (error) {
    console.error("[défis] réussite non enregistrée", {
      assignment: assignmentId,
      code: error.code,
    });
    return false;
  }

  const changed = (data ?? []).length > 0;

  if (!changed) {
    console.info("[défis] défi déjà validé, rien à faire", {
      assignment: assignmentId,
    });
  }

  return changed;
}
