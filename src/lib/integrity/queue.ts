import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The arbitration queue (story 9.7).
 *
 * **Two clicks, otherwise the queue wins.** A queue that requires
 * understanding a form is a queue somebody looks at on day one and abandons
 * on day three — and an abandoned queue is worse than no queue, because it
 * looks like the game is being watched when it is not.
 *
 * Read through the administrator's own session: the policy on the table says
 * admins read the queue, and it is that policy which decides.
 */

export type QueuedFlag = {
  id: string;
  rule: string;
  observed: number;
  threshold: number;
  unit: string;
  createdAt: string;
  participant: { id: string; displayName: string };
  activity: {
    name: string;
    sportFamily: string;
    localDate: string;
    distanceMeters: number;
    durationSeconds: number;
  } | null;
};

type Row = {
  id: string;
  rule: string;
  observed: number;
  threshold: number;
  unit: string;
  created_at: string;
  profile_id: string;
  activities: {
    name: string;
    sport_family: string;
    local_date: string;
    distance_meters: number;
    duration_seconds: number;
  } | null;
};

/**
 * What is waiting, oldest first.
 *
 * Oldest first because a case left for three weeks is a case nobody will
 * remember the context of — and the queue exists to be emptied, not browsed.
 */
export async function pendingFlags(limit = 50): Promise<QueuedFlag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_flags")
    .select(
      "id, rule, observed, threshold, unit, created_at, profile_id, activities (name, sport_family, local_date, distance_meters, duration_seconds)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[arbitrage] file illisible", { code: error.code });
    return [];
  }

  const rows = (data ?? []) as unknown as Row[];

  const names = await displayNames(rows.map((row) => row.profile_id));

  return rows.map((row) => ({
    id: row.id,
    rule: row.rule,
    observed: Number(row.observed),
    threshold: Number(row.threshold),
    unit: row.unit,
    createdAt: row.created_at,
    participant: {
      id: row.profile_id,
      displayName: names.get(row.profile_id) ?? "Participant",
    },
    activity: row.activities
      ? {
          name: row.activities.name,
          sportFamily: row.activities.sport_family,
          localDate: row.activities.local_date,
          distanceMeters: row.activities.distance_meters,
          durationSeconds: row.activities.duration_seconds,
        }
      : null,
  }));
}

/** How many cases are waiting. Shown on the back-office home. */
export async function pendingFlagCount(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("activity_flags")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return count ?? 0;
}

/**
 * Pseudonyms, from the public view.
 *
 * Reading `profiles` for a name would hand over the e-mail addresses in the
 * same query — the same rule as every other screen that names somebody. The
 * arbitrator who needs to write to them has the participant record for that.
 */
async function displayNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}
