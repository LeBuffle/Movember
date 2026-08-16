import "server-only";

import { stravaConfigured } from "@/lib/activities/sources/strava";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether activities are still arriving.
 *
 * **Derived from the data, not from a counter in memory.** A counter would
 * reset every time the container restarts — which is exactly what happens
 * during an incident — and would say "everything is fine" at the worst
 * possible moment. The links themselves carry when they were last reached,
 * so the answer survives a restart and cannot drift from reality.
 *
 * A participant's own screen reads the same thing (story 3.9 AC 2): telling
 * them "the synchronisation is disturbed, your outings will be picked up
 * automatically" costs one sentence and saves thirty messages, because from
 * where they stand a Strava outage and a broken game look identical.
 */

/** Beyond this without being reached, a link is behind. */
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/** Below this share of links reached recently, something is wrong. */
const DEGRADED_BELOW = 0.6;

export type SyncHealth = {
  /** `idle` means nobody has linked an account yet — not a problem. */
  state: "ok" | "degraded" | "down" | "idle" | "unconfigured";
  links: number;
  recent: number;
  broken: number;
  lastSyncedAt: string | null;
};

export async function activitySyncHealth(): Promise<SyncHealth> {
  if (!stravaConfigured()) {
    return {
      state: "unconfigured",
      links: 0,
      recent: 0,
      broken: 0,
      lastSyncedAt: null,
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activity_connections")
    .select("status, last_synced_at")
    .eq("provider", "strava")
    .is("disconnected_at", null);

  if (error) {
    console.error("[santé] liaisons illisibles", { code: error.code });
    return {
      state: "down",
      links: 0,
      recent: 0,
      broken: 0,
      lastSyncedAt: null,
    };
  }

  const rows = data ?? [];
  const live = rows.filter((row) => row.status === "active");
  const threshold = Date.now() - STALE_AFTER_MS;

  const recent = live.filter(
    (row) =>
      row.last_synced_at && new Date(row.last_synced_at).getTime() >= threshold,
  ).length;

  const lastSyncedAt =
    rows
      .map((row) => row.last_synced_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const broken = rows.filter((row) => row.status === "broken").length;

  if (live.length === 0) {
    return { state: "idle", links: 0, recent: 0, broken, lastSyncedAt };
  }

  // Nobody reached at all is an outage; most but not all is a disturbance.
  // The distinction matters because one of them is worth waking somebody up.
  const share = recent / live.length;
  const state =
    share === 0 ? "down" : share < DEGRADED_BELOW ? "degraded" : "ok";

  return { state, links: live.length, recent, broken, lastSyncedAt };
}

/**
 * The same question for one participant.
 *
 * Their own link is what they can act on. A global outage is worth telling
 * them about too, but "your account has not been reached since yesterday" is
 * the sentence that stops them wondering whether their run counted.
 */
export type ParticipantSyncState = "ok" | "behind" | "broken" | "none";

export async function participantSyncState(
  profileId: string,
): Promise<ParticipantSyncState> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("activity_connections")
    .select("status, last_synced_at")
    .eq("profile_id", profileId)
    .eq("provider", "strava")
    .is("disconnected_at", null)
    .maybeSingle();

  if (!data) return "none";
  if (data.status === "broken") return "broken";

  if (
    !data.last_synced_at ||
    new Date(data.last_synced_at).getTime() < Date.now() - STALE_AFTER_MS
  ) {
    return "behind";
  }

  return "ok";
}

/** The signed-in participant's own state, for their game screen. */
export async function ownSyncState(): Promise<ParticipantSyncState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "none";

  return participantSyncState(user.id);
}
