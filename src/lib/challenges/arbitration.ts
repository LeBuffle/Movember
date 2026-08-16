import "server-only";

import { readChallengeConfig } from "@/lib/challenges/config";
import { describeChallenge } from "@/lib/challenges/describe";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * What the back-office needs in order to decide a challenge by hand.
 *
 * Read through the administrator's own session, so row level security
 * answers — the admin policies of story 4.1 open every assignment and the
 * whole catalogue to an administrator, and nothing to anyone else. Only the
 * arbitration itself reaches for the service key, and only because
 * `challenge_assignments` deliberately has no write policy for anybody.
 */

export type ArbitrationTarget = {
  id: string;
  assignedFor: string;
  status: "open" | "completed" | "missed";
  source: string;
  title: string;
  /** The same sentences the catalogue shows, produced by the same function. */
  lines: string[];
  points: number;
  pointsAwarded: number | null;
  completedAt: string | null;
  /** What the evaluator measured, when it measured anything. */
  measured: number | null;
  arbitratedAt: string | null;
  participantId: string;
  participantName: string;
};

type AssignmentRow = {
  id: string;
  profile_id: string;
  assigned_for: string;
  status: ArbitrationTarget["status"];
  source: string;
  completed_at: string | null;
  points_awarded: number | null;
  arbitrated_at: string | null;
  evidence: Record<string, unknown> | null;
  challenges: {
    title: string;
    evaluator: string;
    config: Record<string, unknown>;
    points: number;
  } | null;
};

const COLUMNS =
  "id, profile_id, assigned_for, status, source, completed_at, points_awarded, arbitrated_at, evidence, challenges (title, evaluator, config, points)";

function toTarget(row: AssignmentRow, participantName: string) {
  const challenge = row.challenges;
  const config = challenge
    ? readChallengeConfig(challenge.evaluator, challenge.config)
    : null;

  return {
    id: row.id,
    assignedFor: row.assigned_for,
    status: row.status,
    source: row.source,
    title: challenge?.title ?? "défi supprimé",
    lines:
      challenge && config ? describeChallenge(challenge.evaluator, config) : [],
    points: challenge?.points ?? 0,
    pointsAwarded: row.points_awarded,
    completedAt: row.completed_at,
    measured:
      typeof row.evidence?.measured === "number" ? row.evidence.measured : null,
    arbitratedAt: row.arbitrated_at,
    participantId: row.profile_id,
    participantName,
  };
}

/**
 * Participants matching a search on their pseudonym.
 *
 * A search box rather than a dropdown of everybody: four hundred names in a
 * `<select>` is unusable on a phone, and this screen is used from a phone in
 * the middle of November.
 */
export async function searchParticipants(
  query: string,
): Promise<Array<{ id: string; displayName: string }>> {
  const term = query.trim();
  if (term.length < 2) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    // Escaped: `%` and `_` are wildcards in `ilike`, and a pseudonym is free
    // text. Without this, searching for "_" would list everybody.
    .ilike("display_name", `%${term.replace(/[%_\\]/g, "\\$&")}%`)
    .order("display_name", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[arbitrage] recherche impossible", { code: error.code });
    return [];
  }

  return (data ?? []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name,
  }));
}

/** Everything one participant was given this edition, most recent first. */
export async function listParticipantAssignments(
  profileId: string,
): Promise<ArbitrationTarget[]> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return [];

  const { data, error } = await supabase
    .from("challenge_assignments")
    .select(COLUMNS)
    .eq("profile_id", profileId)
    .order("assigned_for", { ascending: false })
    .limit(80);

  if (error) {
    console.error("[arbitrage] attributions illisibles", { code: error.code });
    return [];
  }

  return (data as unknown as AssignmentRow[]).map((row) =>
    toTarget(row, profile.display_name),
  );
}

export async function getAssignment(
  id: string,
): Promise<ArbitrationTarget | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("challenge_assignments")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as AssignmentRow;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", row.profile_id)
    .maybeSingle();

  return toTarget(row, profile?.display_name ?? "compte supprimé");
}

/* -------------------------------------------------------------------------
 * The trace
 *
 * Every decision, in order, read back from the journal nobody can edit. It
 * is what turns "the points changed" into "who changed them, when, and why"
 * — which is the only useful answer when a leaderboard is contested.
 * ---------------------------------------------------------------------- */

export type ArbitrationEntry = {
  id: string;
  createdAt: string;
  action: string;
  adminName: string;
  reason: string;
  previousStatus: string | null;
};

export async function listArbitrations(
  assignmentId: string,
): Promise<ArbitrationEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, created_at, action, admin_id, payload")
    .eq("target_table", "challenge_assignments")
    .eq("target_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) return [];

  const adminIds = [...new Set(data.map((entry) => entry.admin_id))];

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", adminIds);

  const nameBy = new Map(
    (admins ?? []).map((admin) => [admin.id, admin.display_name]),
  );

  return data.map((entry) => {
    const payload = entry.payload as Record<string, unknown>;

    return {
      id: entry.id,
      createdAt: entry.created_at,
      action: entry.action,
      // The journal outlives the account it names, so a deleted
      // administrator leaves an entry with no name rather than no entry.
      adminName: nameBy.get(entry.admin_id) ?? "compte supprimé",
      reason: typeof payload.reason === "string" ? payload.reason : "",
      previousStatus:
        typeof payload.previous_status === "string"
          ? payload.previous_status
          : null,
    };
  });
}

/** The most recent decisions of the edition, all participants together. */
export async function listRecentArbitrations(
  limit = 20,
): Promise<ArbitrationTarget[]> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data, error } = await supabase
    .from("challenge_assignments")
    .select(COLUMNS)
    .eq("edition_id", edition.id)
    .not("arbitrated_at", "is", null)
    .order("arbitrated_at", { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return [];

  const rows = data as unknown as AssignmentRow[];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(rows.map((row) => row.profile_id))]);

  const nameBy = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  return rows.map((row) =>
    toTarget(row, nameBy.get(row.profile_id) ?? "compte supprimé"),
  );
}
