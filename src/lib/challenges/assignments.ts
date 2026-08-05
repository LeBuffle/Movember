import "server-only";

import { readChallengeConfig } from "@/lib/challenges/config";
import { describeChallenge } from "@/lib/challenges/describe";
import { createClient } from "@/lib/supabase/server";

/**
 * The challenges a participant has, as their screen needs them.
 *
 * Read through their own session, so row level security answers: the policy
 * of story 4.1 shows a participant their own assignments and — through them,
 * and only through them — the challenges they name. The rest of the catalogue
 * stays a spoiler.
 *
 * A thin version of what story 4.6 will build properly. What matters here is
 * that a result reached by the evaluator is actually visible (story 4.3
 * AC 7), rather than only true in the database.
 */

export type ParticipantChallenge = {
  id: string;
  assignedFor: string;
  status: "open" | "completed" | "missed";
  /** `common` is the challenge everybody got that day (story 4.8). */
  source: "draw" | "catchup" | "common" | "manual";
  title: string;
  description: string;
  /** The same sentences the author validated in the back-office. */
  lines: string[];
  points: number;
  pointsAwarded: number | null;
  completedAt: string | null;
  /** What satisfied it, if anything did. */
  measured: number | null;
  /** Kept so the screen can show a goal, and one day a progress bar. */
  evaluator: string;
  config: Record<string, unknown> | null;
};

export async function getParticipantChallenges(
  limit = 10,
): Promise<ParticipantChallenge[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  return readAssignments(supabase, user.id, { limit });
}

type Window = { limit: number } | { from: number; to: number };

/**
 * The rows, mapped once.
 *
 * Shared by the game screen and the history so that a challenge cannot read
 * one way in one place and another way elsewhere — which is exactly what
 * happens when two screens each map their own query.
 */
async function readAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  window: Window,
): Promise<ParticipantChallenge[]> {
  const query = supabase
    .from("challenge_assignments")
    .select(
      "id, assigned_for, status, source, completed_at, points_awarded, evidence, challenges (title, description, evaluator, config, points)",
    )
    .eq("profile_id", profileId)
    .order("assigned_for", { ascending: false });

  const { data, error } =
    "limit" in window
      ? await query.limit(window.limit)
      : await query.range(window.from, window.to);

  if (error) {
    console.error("[défis] défis du participant illisibles", {
      code: error.code,
    });
    return [];
  }

  type Row = {
    id: string;
    assigned_for: string;
    status: ParticipantChallenge["status"];
    source: ParticipantChallenge["source"];
    completed_at: string | null;
    points_awarded: number | null;
    evidence: Record<string, unknown> | null;
    challenges: {
      title: string;
      description: string;
      evaluator: string;
      config: Record<string, unknown>;
      points: number;
    } | null;
  };

  return (data as unknown as Row[])
    .filter((row) => row.challenges !== null)
    .map((row) => {
      const challenge = row.challenges!;
      const config = readChallengeConfig(challenge.evaluator, challenge.config);

      return {
        id: row.id,
        assignedFor: row.assigned_for,
        status: row.status,
        source: row.source,
        title: challenge.title,
        description: challenge.description,
        // A challenge whose settings no longer parse is shown as a title with
        // no rule, rather than with a rule invented on the spot.
        lines: config ? describeChallenge(challenge.evaluator, config) : [],
        points: challenge.points,
        pointsAwarded: row.points_awarded,
        completedAt: row.completed_at,
        evaluator: challenge.evaluator,
        config,
        measured:
          typeof row.evidence?.measured === "number"
            ? row.evidence.measured
            : null,
      };
    });
}

/* -------------------------------------------------------------------------
 * The history
 *
 * A screen of motivation as much as of consultation: the cumulative total is
 * what people look at, and the detail is what they reach for when they think
 * a challenge was wrongly marked missed.
 * ---------------------------------------------------------------------- */

export type HistoryPage = {
  items: ParticipantChallenge[];
  page: number;
  pageCount: number;
  total: number;
  /** Over the whole edition, not over the page. */
  stats: { completed: number; missed: number; open: number; points: number };
};

export const HISTORY_PAGE_SIZE = 20;

/**
 * @param page 1-based. Out-of-range pages are clamped rather than refused —
 *   a stale link in a browser's history should show the last page, not an
 *   error.
 *
 * Paginated because a thirty-day edition with a common challenge on top can
 * reach sixty rows, and because the same screen will be reused for an edition
 * that ran longer. The totals are computed over everything, never over the
 * page: a total that changed when you turned the page would be worse than no
 * total at all.
 */
export async function getChallengeHistory(page = 1): Promise<HistoryPage> {
  const empty: HistoryPage = {
    items: [],
    page: 1,
    pageCount: 1,
    total: 0,
    stats: { completed: 0, missed: 0, open: 0, points: 0 },
  };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return empty;

  // Everything, but only three columns: the totals must cover the whole
  // edition, and this is cheap enough not to deserve a stored counter that
  // could drift.
  const { data: all, error: statsError } = await supabase
    .from("challenge_assignments")
    .select("status, points_awarded, challenges (points)")
    .eq("profile_id", user.id);

  if (statsError) {
    console.error("[défis] historique illisible", { code: statsError.code });
    return empty;
  }

  type StatRow = {
    status: ParticipantChallenge["status"];
    points_awarded: number | null;
    challenges: { points: number } | null;
  };

  const rows = (all ?? []) as unknown as StatRow[];

  const stats = {
    completed: rows.filter((row) => row.status === "completed").length,
    missed: rows.filter((row) => row.status === "missed").length,
    open: rows.filter((row) => row.status === "open").length,
    points: rows
      .filter((row) => row.status === "completed")
      .reduce(
        (total, row) =>
          total + (row.points_awarded ?? row.challenges?.points ?? 0),
        0,
      ),
  };

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const from = (current - 1) * HISTORY_PAGE_SIZE;

  const items = await readAssignments(supabase, user.id, {
    from,
    to: from + HISTORY_PAGE_SIZE - 1,
  });

  return { items, page: current, pageCount, total, stats };
}
