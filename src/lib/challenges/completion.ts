import "server-only";

import type { Activity } from "@/lib/activities/activity";
import { readChallengeConfig } from "@/lib/challenges/config";
import { evaluate, type Verdict } from "@/lib/challenges/evaluators/evaluate";
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
 * "One activity may satisfy several challenges" is story 4.5. Here every open
 * assignment is offered the activity independently, which is the same thing
 * for the single-challenge case and does not have to be undone later.
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
    .eq("status", "open");

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

    const verdict = evaluate(challenge.evaluator, {
      activity,
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
