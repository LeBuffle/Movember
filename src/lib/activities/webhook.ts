import "server-only";

import { validAccessToken } from "@/lib/activities/refresh";
import { activitySource } from "@/lib/activities/sources";
import {
  recordActivities,
  removeActivity,
  updateActivity,
} from "@/lib/activities/store";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What Strava sends, and what we do about it.
 *
 * Kept out of the route so it can be read and tested without a request. The
 * route's job is to answer fast; this one's is to be right.
 */

export type StravaEvent = {
  objectType: "activity" | "athlete";
  aspectType: "create" | "update" | "delete";
  /** The activity's identifier, or the athlete's on a deauthorisation. */
  objectId: string;
  /** The athlete the event concerns. Our only link back to a participant. */
  ownerId: string;
  /** Present on an athlete update that revokes our authorisation. */
  authorised: boolean | null;
};

/**
 * Reads a payload without trusting any of it.
 *
 * Everything here arrives over an unsigned call, so nothing is assumed: a
 * field of the wrong type, a verb we do not know, an athlete we cannot read
 * — each one produces `null` rather than a partially understood event.
 */
export function readStravaEvent(payload: unknown): StravaEvent | null {
  if (typeof payload !== "object" || payload === null) return null;

  const body = payload as Record<string, unknown>;

  const objectType = body.object_type;
  const aspectType = body.aspect_type;

  if (objectType !== "activity" && objectType !== "athlete") return null;

  if (
    aspectType !== "create" &&
    aspectType !== "update" &&
    aspectType !== "delete"
  ) {
    return null;
  }

  const objectId = body.object_id;
  const ownerId = body.owner_id;

  if (
    (typeof objectId !== "number" && typeof objectId !== "string") ||
    (typeof ownerId !== "number" && typeof ownerId !== "string")
  ) {
    return null;
  }

  const updates = body.updates;
  const authorised =
    updates && typeof updates === "object" && "authorized" in updates
      ? (updates as { authorized?: unknown }).authorized === "true" ||
        (updates as { authorized?: unknown }).authorized === true
      : null;

  return {
    objectType,
    aspectType,
    objectId: String(objectId),
    ownerId: String(ownerId),
    authorised,
  };
}

export type EventOutcome =
  | "stored"
  | "updated"
  | "removed"
  | "unlinked"
  | "unknown-athlete"
  | "unavailable"
  | "ignored";

/**
 * Acting on one event.
 *
 * **Nothing from the payload is ever stored.** It names an activity; we go
 * and ask Strava for it, with the participant's own token. That is what makes
 * an unsigned webhook acceptable: a forged call costs one API call on an
 * athlete we already know, and can never inject a 40 km run.
 */
export async function handleStravaEvent(
  event: StravaEvent,
): Promise<EventOutcome> {
  const profileId = await profileForAthlete(event.ownerId);

  // An event for somebody who is not ours — a stale subscription, a forged
  // call, an athlete who unlinked. Dropped without a fetch.
  if (!profileId) return "unknown-athlete";

  if (event.objectType === "athlete") {
    // Strava sends this when the participant revokes us from their own
    // settings. Marking the link broken here saves them the wait until the
    // hourly refresh finds out (story 3.7).
    if (event.aspectType === "update" && event.authorised === false) {
      await breakLink(profileId);
      return "unlinked";
    }

    return "ignored";
  }

  if (event.aspectType === "delete") {
    await removeActivity("strava", event.objectId);
    return "removed";
  }

  const source = activitySource("strava");
  if (!source) return "ignored";

  const token = await validAccessToken(profileId, "strava");
  if (!token.ok) return "unavailable";

  const fetched = await source.fetchActivity(
    token.token,
    profileId,
    event.objectId,
  );

  if (!fetched.ok) {
    // `invalid` covers an activity Strava will not show us — deleted between
    // the event and our call, or private beyond our scope. Not worth an
    // alarm; the catch-up will not find it either.
    return fetched.reason === "unavailable" ? "unavailable" : "ignored";
  }

  if (event.aspectType === "update") {
    await updateActivity(fetched.value);
    return "updated";
  }

  const report = await recordActivities([fetched.value]);

  return report.stored > 0 ? "stored" : "ignored";
}

/** Which participant an athlete identifier belongs to, if any. */
async function profileForAthlete(ownerId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("activity_connections")
    .select("profile_id")
    .eq("provider", "strava")
    .eq("provider_account_id", ownerId)
    .is("disconnected_at", null)
    .maybeSingle();

  return data?.profile_id ?? null;
}

async function breakLink(profileId: string): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from("activity_connections")
    .update({ status: "broken", broken_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("provider", "strava")
    .is("disconnected_at", null);

  console.warn("[strava] autorisation révoquée par le participant");
}
