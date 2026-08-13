import "server-only";

import type { ActivityProvider } from "@/lib/activities/activity";
import { validAccessToken } from "@/lib/activities/refresh";
import { activitySource } from "@/lib/activities/sources";
import { recordActivities } from "@/lib/activities/store";
import { editionStartDate } from "@/lib/edition/start";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fetching what the webhook missed.
 *
 * **The safety net, and on one environment the main mechanism.** Strava
 * allows a single webhook subscription per application — so preproduction or
 * production, not both — and the environment without it sees activities
 * arrive only through this. Which makes it worth writing as if it were the
 * only path, because for one of the two it is.
 *
 * A webhook can be lost in ordinary ways: the service restarted, the
 * delivery failed, the subscription points at the other environment. Without
 * a catch-up the participant loses a challenge and never learns why. With
 * one, they notice nothing.
 */

/** Never the participant's whole history — only the edition. */
export type SyncWindow = { after: Date; before: Date };

export type SyncOutcome =
  | { ok: true; received: number; stored: number; completed: number }
  | {
      ok: false;
      reason:
        | "no-link"
        | "unavailable"
        | "broken"
        /** The edition has not started: there is nothing to fetch yet. */
        | "before-edition";
    };

/**
 * How far back a catch-up reaches on a routine run.
 *
 * Two days rather than an hour: a delivery lost overnight, or a service down
 * for a morning, is exactly what this exists for. Re-reading two days costs
 * one call per participant and the database refuses the duplicates.
 */
const ROUTINE_WINDOW_DAYS = 2;

/** A run's worth of participants. Well above four hundred. */
const MAX_PER_RUN = 500;

/**
 * The edition's own start, which is as far back as an import ever goes.
 *
 * Bringing back three years of outings would burn the call quota, store data
 * the game has no use for, and go against the minimisation this whole epic
 * is built on (architecture D9).
 *
 * **Read from `editions.starts_on`, not written here.** It used to be a
 * hard-coded 1 November, and that had two consequences neither of which was
 * intended. The first is that nothing could be tested before November: the
 * window handed to Strava started after it ended, so every fetch came back
 * empty, silently, and a linked account looked broken. The second is that the
 * date existed twice — the fil rouge evaluation already read the column — so
 * the two could disagree without anything saying so. See `edition/start.ts`.
 */

/**
 * Synchronises one participant over a window.
 *
 * Goes through `validAccessToken`, so it never has to know that tokens
 * expire — story 3.7 answers that, and refreshes ahead of need.
 */
export async function syncParticipant(
  profileId: string,
  window?: SyncWindow,
  provider: ActivityProvider = "strava",
): Promise<SyncOutcome> {
  return syncOne(profileId, provider, window, await editionStartDate());
}

/**
 * One participant, with the edition's start already resolved.
 *
 * Split out so the hourly sweep reads the edition once rather than once per
 * participant — five hundred identical queries to learn the same date.
 */
async function syncOne(
  profileId: string,
  provider: ActivityProvider,
  window: SyncWindow | undefined,
  start: Date,
): Promise<SyncOutcome> {
  const source = activitySource(provider);
  if (!source) return { ok: false, reason: "no-link" };

  const token = await validAccessToken(profileId, provider);

  if (!token.ok) {
    return {
      ok: false,
      reason:
        token.reason === "broken"
          ? "broken"
          : token.reason === "missing"
            ? "no-link"
            : "unavailable",
    };
  }

  const now = new Date();
  const range = window ?? {
    after: new Date(now.getTime() - ROUTINE_WINDOW_DAYS * 86_400_000),
    before: new Date(now.getTime() + 60_000),
  };

  // Never before the edition, whatever was asked. A caller passing a wider
  // window would otherwise import somebody's whole sporting past.
  const after = range.after < start ? start : range.after;

  // **Said rather than fetched.** Before the edition opens, the clamped
  // window starts after it ends: Strava answers with an empty list and no
  // error, so a linked account looks like an account that has done no sport.
  // That silence is what made this hard to diagnose in the first place.
  if (after >= range.before) return { ok: false, reason: "before-edition" };

  const fetched = await source.fetchActivities(token.token, profileId, {
    after,
    before: range.before,
  });

  if (!fetched.ok) {
    return {
      ok: false,
      reason: fetched.reason === "denied" ? "broken" : "unavailable",
    };
  }

  // Through the same door as the webhook and the simulated injection: stored
  // once, evaluated once, duplicates refused by the database.
  const report = await recordActivities(fetched.value);

  await stampSync(profileId, provider);

  return {
    ok: true,
    received: report.received,
    stored: report.stored,
    completed: report.completed,
  };
}

/**
 * Everything a participant has done since the edition began.
 *
 * Run once, when they link their account: somebody joining on 12 November
 * should find their first eleven days counted, not start from zero.
 */
export async function importInitialActivities(
  profileId: string,
  provider: ActivityProvider = "strava",
): Promise<SyncOutcome> {
  const start = await editionStartDate();

  return syncOne(
    profileId,
    provider,
    { after: start, before: new Date(Date.now() + 60_000) },
    start,
  );
}

export type CatchUpReport = {
  participants: number;
  stored: number;
  completed: number;
  unavailable: number;
  broken: number;
  /** Reached before the edition opened. Not a failure — a calendar. */
  tooEarly: number;
};

/**
 * The hourly sweep across every live link.
 *
 * Reports rather than throws, and answers 200 even when some participants
 * could not be reached: a task that fails on a partial run is a task whose
 * alerts stop being read.
 */
export async function runCatchUp(
  provider: ActivityProvider = "strava",
): Promise<CatchUpReport> {
  const admin = createAdminClient();
  const report: CatchUpReport = {
    participants: 0,
    stored: 0,
    completed: 0,
    unavailable: 0,
    broken: 0,
    tooEarly: 0,
  };

  const { data, error } = await admin
    .from("activity_connections")
    .select("profile_id")
    .eq("provider", provider)
    .eq("status", "active")
    .is("disconnected_at", null)
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[rattrapage] liaisons illisibles", { code: error.code });
    return report;
  }

  const links = data ?? [];
  report.participants = links.length;

  // Read once for the whole sweep, not once per participant.
  const start = await editionStartDate();

  for (const link of links) {
    const outcome = await syncOne(link.profile_id, provider, undefined, start);

    if (outcome.ok) {
      report.stored += outcome.stored;
      report.completed += outcome.completed;
      continue;
    }

    if (outcome.reason === "broken") report.broken += 1;
    else if (outcome.reason === "before-edition") report.tooEarly += 1;
    else report.unavailable += 1;
  }

  if (report.unavailable > 0) {
    // One participant unreachable is noise; all of them is an outage, and
    // story 3.9 is what turns that into an alert somebody sees.
    console.warn("[rattrapage] participants non synchronisés", {
      unavailable: report.unavailable,
      participants: report.participants,
    });
  }

  return report;
}

/** When this participant was last reached, for their screen (story 3.8). */
async function stampSync(
  profileId: string,
  provider: ActivityProvider,
): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from("activity_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .is("disconnected_at", null);
}
