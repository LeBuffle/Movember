import "server-only";

import { addDays, type Activity } from "@/lib/activities/activity";
import { readChallengeConfig } from "@/lib/challenges/config";
import { evaluate, type Verdict } from "@/lib/challenges/evaluators/evaluate";
import {
  EVALUATORS,
  type EvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import { pickCardForChallenge } from "@/lib/cards/grant";
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
  /**
   * What was just completed, in order.
   *
   * Returned rather than counted so the caller can group the notifications
   * (story 6.6): one Sunday outing can settle three challenges at once, and
   * three separate messages would read as noise — which is what gets
   * notifications switched off.
   */
  completions: CompletedChallenge[];
  /**
   * Set when the activity was typed in by hand rather than recorded (story
   * 9.8). Nothing was evaluated, and that is not a failure to report as one.
   */
  skippedManual?: boolean;
};

export type CompletedChallenge = {
  title: string;
  /** Whether this completion also produced a card. */
  cardGranted: boolean;
};

type OpenAssignment = {
  id: string;
  assigned_for: string;
  edition_id: string;
  challenge: {
    title: string;
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
  // **A hand-typed outing validates nothing** (story 9.8, architecture D10).
  // Strava lets anyone declare a 42 km run without moving; the game rests on
  // what was recorded, not on what was claimed.
  //
  // The distinction is manual versus imported, not GPS versus not-GPS.
  // Refusing everything that did not come straight from a phone's sensor
  // would exclude Garmin, Polar and Coros users — that is, the most committed
  // participants.
  //
  // Checked once, here, rather than in each of the seven evaluators. A rule
  // repeated seven times is a rule that will hold in six places.
  if (activity.isManual) {
    return {
      examined: 0,
      completed: 0,
      unsupported: 0,
      completions: [],
      skippedManual: true,
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("challenge_assignments")
    .select(
      "id, assigned_for, edition_id, challenges (title, evaluator, config, points, duration_days)",
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
    return { examined: 0, completed: 0, unsupported: 0, completions: [] };
  }

  const assignments = (data ?? []) as unknown as Array<
    Omit<OpenAssignment, "challenge"> & {
      challenges: OpenAssignment["challenge"] | null;
    }
  >;

  let unsupported = 0;
  const completions: CompletedChallenge[] = [];

  // Loaded once, lazily, and shared by every assignment that needs it.
  //
  // Before story 3.1 there was no activity store at all, so the evaluators
  // that judge on several activities — regularity, multi-sport, and now a
  // cumulative distance — always refused. The table exists now, so they can
  // actually be judged; the laziness is what keeps the common case (one
  // activity, one threshold) at a single query.
  let history: Activity[] | undefined;
  let historyLoaded = false;

  /* The edition's first day, read once and only if a fil rouge needs it.
     **It is the floor under every retroactive window** (décision PO du
     11 août) : without it, a multi-day challenge handed out on 2 November
     would be settled by October's training. Read lazily because most days
     nobody receives a fil rouge, and this would then be a query for
     nothing. */
  let editionStartsOn: string | undefined;
  let editionLoaded = false;

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

    const days = challenge.duration_days ?? 1;

    if (days > 1 && !editionLoaded) {
      editionStartsOn = await readEditionStart(assignment.edition_id);
      editionLoaded = true;
    }

    const verdict = evaluate(challenge.evaluator, {
      activity,
      history,
      config,
      context: {
        assignedFor: assignment.assigned_for,
        durationDays: days,
        editionStartsOn,
      },
    });

    if (!verdict.completed) {
      if ("unsupported" in verdict) unsupported += 1;
      continue;
    }

    const written = await recordCompletion(
      assignment.id,
      activity.profileId,
      assignment.edition_id,
      challenge.points,
      verdict,
    );

    if (written.completed) {
      completions.push({
        title: challenge.title,
        cardGranted: written.cardGranted,
      });
    }
  }

  return {
    examined: assignments.length,
    completed: completions.length,
    unsupported,
    completions,
  };
}

/**
 * The edition's first day.
 *
 * @returns `undefined` when it cannot be read — and the retroactive window
 *   then has no floor. That is the safe direction of the two: a window
 *   reaching a few days too far back completes a challenge slightly early,
 *   while refusing to judge would leave every fil rouge of the month open.
 *   The activity history itself never predates the sporting account anyway.
 */
async function readEditionStart(
  editionId: string,
): Promise<string | undefined> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("editions")
    .select("starts_on")
    .eq("id", editionId)
    .maybeSingle();

  if (error || !data) {
    console.error("[défis] début d’édition illisible", { code: error?.code });
    return undefined;
  }

  return data.starts_on;
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
      "provider_activity_id, provider, name, sport_family, started_at, local_date, distance_meters, duration_seconds, elevation_meters, is_manual",
    )
    .eq("profile_id", activity.profileId)
    // Same rule as above, and it has to be here too: a cumulative challenge
    // adds up several outings, and a hand-typed one would slip into the total
    // without ever having been judged on its own.
    .eq("is_manual", false)
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
    is_manual: boolean;
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
    isManual: row.is_manual,
  }));
}

export type CompletionOutcome = {
  /** Whether this call is the one that completed it. */
  completed: boolean;
  /** Whether a card came with it. Null is normal until the visuals exist. */
  cardGranted: boolean;
};

/**
 * @returns what this call actually did.
 *
 * `completed: false` covers two very different things — it was already done,
 * or the write failed — and both are logged distinctly, which is where the
 * difference matters. The caller only needs to know whether to announce it.
 */
async function recordCompletion(
  assignmentId: string,
  profileId: string,
  editionId: string,
  points: number,
  verdict: Extract<Verdict, { completed: true }>,
): Promise<CompletionOutcome> {
  const admin = createAdminClient();

  // Drawn before the write, because the write is a transaction and must not
  // wait on anything. A null card is a normal answer — the catalogue is empty
  // until the visuals arrive in September — and the challenge validates all
  // the same. A challenge without a card is a shame; a challenge that fails
  // to validate is a bug.
  const cardId = await pickCardForChallenge(profileId, editionId);

  // One function, one transaction: the challenge and its card switch
  // together or not at all (story 5.3 AC 3). Two statements from here could
  // not promise that, and the failure that matters — points awarded with no
  // card — is the one a participant notices immediately.
  const { data, error } = await admin.rpc("complete_challenge_with_card", {
    p_assignment_id: assignmentId,
    p_points: points,
    p_evidence: {
      activity_ids: verdict.evidence.activityIds,
      measured: verdict.evidence.measured,
    },
    p_card_id: cardId,
  });

  if (error) {
    console.error("[défis] réussite non enregistrée", {
      assignment: assignmentId,
      code: error.code,
    });
    return { completed: false, cardGranted: false };
  }

  const outcome = (data ?? [])[0];

  if (!outcome?.completed) {
    console.info("[défis] défi déjà validé, rien à faire", {
      assignment: assignmentId,
    });
    return { completed: false, cardGranted: false };
  }

  return { completed: true, cardGranted: Boolean(outcome.card_id) };
}
