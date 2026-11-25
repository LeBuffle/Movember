import "server-only";

import type { Activity } from "@/lib/activities/activity";
import { evaluate } from "@/lib/challenges/evaluators/evaluate";
import { notifyDuelMet } from "@/lib/duels/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Settling a duel with a real outing (story 12.5).
 *
 * **This is the story that decides whether the mechanism means anything.**
 * Without a strict time window, somebody who receives "courir 2 km" at six in
 * the evening settles it with their seven-o'clock-that-morning run, without
 * getting out of their chair. The duel would stop being a duel, and the whole
 * mechanism would become a way of spending 2 € on nothing.
 *
 * So the window is checked here, to the minute, and it is checked before the
 * evaluator ever sees the activity:
 *
 * - the outing **starts after the duel was sent** — that is what "tu as 24 h"
 *   means, and the lower bound is the send time, not the day;
 * - it **ends before the deadline**.
 *
 * The evaluator then judges the effort alone — distance, duration, sport — on
 * a one-day window it cannot fail, because the real window has already been
 * applied. Splitting it that way is deliberate: the challenge engine reasons
 * in calendar days, and a duel does not.
 *
 * **A duel earns nothing** (decision P7): no point, no card, no rank. That
 * single decision is what makes any anti-farming machinery unnecessary — two
 * friends trading duels all day have nothing to gain by it.
 */

export type DuelSettlement = {
  examined: number;
  met: number;
};

type OpenDuel = {
  id: string;
  receiver_id: string;
  sent_at: string;
  expires_at: string;
  duel_types: {
    evaluator: string;
    config: Record<string, unknown>;
  } | null;
};

/** A hard stop. Five a day for thirty days is the worst legitimate case. */
const MAX_OPEN_DUELS = 60;

/**
 * Applies one activity to every duel this participant still has open.
 *
 * Called alongside `applyActivity`, not from inside it: the challenge engine
 * and the duels share evaluators and nothing else, and a failure in one must
 * not cost the other. **A single outing can settle the day's challenge and a
 * received duel at once** (AC 6) — the person went out once and satisfied two
 * demands, one of which they did not choose. Refusing would punish them for
 * having been challenged.
 */
export async function applyActivityToDuels(
  activity: Activity,
): Promise<DuelSettlement> {
  // **A hand-typed outing settles nothing** (story 9.8, architecture D10).
  // The same rule as the challenges, checked here too rather than trusted:
  // Strava lets anyone declare a 42 km run without moving, and a duel is
  // precisely the place somebody would be tempted.
  if (activity.isManual) return { examined: 0, met: 0 };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("duels")
    .select(
      "id, receiver_id, sent_at, expires_at, duel_types (evaluator, config)",
    )
    .eq("receiver_id", activity.profileId)
    .eq("status", "open")
    // Both bounds in the query, so a month of expired duels is never read.
    .lt("sent_at", activity.startedAt)
    .gt("expires_at", activity.startedAt)
    .limit(MAX_OPEN_DUELS);

  if (error) {
    console.error("[défis-joueurs] défis en cours illisibles", {
      profile: activity.profileId,
      code: error.code,
    });
    return { examined: 0, met: 0 };
  }

  const duels = (data ?? []) as unknown as OpenDuel[];

  let met = 0;

  for (const duel of duels) {
    if (!duel.duel_types) continue;

    // Re-checked here rather than trusted to the query. The bound that
    // matters is this one, and a filter is easy to weaken by accident three
    // months from now; a condition next to the decision is not.
    if (!withinDuelWindow(activity, duel.sent_at, duel.expires_at)) continue;

    const verdict = evaluate(duel.duel_types.evaluator, {
      activity,
      config: duel.duel_types.config ?? {},
      /* The day of the activity itself, over one day. The evaluator's own
         window is therefore always satisfied, which is exactly what we want:
         the real window has been applied above, to the minute. Handing it the
         duel's send date instead would reject an outing that starts at 23:50
         on the day after — inside the 24 hours, outside the calendar day. */
      context: { assignedFor: activity.localDate, durationDays: 1 },
    });

    if (!verdict.completed) continue;

    if (await recordMet(duel.id, activity)) {
      met += 1;
      // After the write, and unable to undo it.
      await notifyDuelMet(duel.id);
    }
  }

  return { examined: duels.length, met };
}

/**
 * The window, stated once.
 *
 * Exported so it can be tested on its own: it carries the rule the whole epic
 * rests on, and it is three comparisons long.
 */
export function withinDuelWindow(
  activity: Pick<Activity, "startedAt" | "durationSeconds">,
  sentAt: string,
  expiresAt: string,
): boolean {
  const started = Date.parse(activity.startedAt);
  const sent = Date.parse(sentAt);
  const expires = Date.parse(expiresAt);

  if (!Number.isFinite(started) || !Number.isFinite(sent)) return false;
  if (!Number.isFinite(expires)) return false;

  // Strictly after: an outing that started before the duel existed cannot be
  // an answer to it.
  if (started <= sent) return false;

  // And it has to be over before the deadline. Using the end rather than the
  // start is the reading that matches "vous avez 24 heures pour le relever":
  // a run begun five minutes before the deadline and finished an hour later
  // was not done inside the window.
  const ended = started + Math.max(0, activity.durationSeconds) * 1000;

  return ended <= expires;
}

/**
 * Marks a duel met, once.
 *
 * The guard is carried by the write — `.eq("status", "open")` — rather than
 * by anything remembered here. Two activities arriving in the same batch
 * cannot both settle the same duel, and a replayed import settles nothing a
 * second time.
 *
 * @returns whether this call is the one that settled it.
 */
async function recordMet(duelId: string, activity: Activity): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("duels")
    .update({
      status: "met",
      met_at: new Date().toISOString(),
      met_activity_id: activity.id,
    })
    .eq("id", duelId)
    .eq("status", "open")
    .select("id");

  if (error) {
    console.error("[défis-joueurs] défi non marqué relevé", {
      duel: duelId,
      code: error.code,
    });
    return false;
  }

  return (data ?? []).length > 0;
}
