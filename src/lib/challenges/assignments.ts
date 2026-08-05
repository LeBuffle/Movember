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

  const { data, error } = await supabase
    .from("challenge_assignments")
    .select(
      "id, assigned_for, status, completed_at, points_awarded, evidence, challenges (title, description, evaluator, config, points)",
    )
    .eq("profile_id", user.id)
    .order("assigned_for", { ascending: false })
    .limit(limit);

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
