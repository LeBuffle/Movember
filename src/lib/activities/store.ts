import "server-only";

import type { Activity } from "@/lib/activities/activity";
import {
  applyActivity,
  type CompletedChallenge,
} from "@/lib/challenges/completion";
import { applyActivityToDuels } from "@/lib/duels/evaluate";
import { flagActivity, readThresholds } from "@/lib/integrity/flags";
import { notifyCompletions } from "@/lib/notifications/game";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where activities enter the game — the one door, whatever the source.
 *
 * Runs with the service key, like the payment webhook of story 2.4 and for
 * the same reason: it acts on nobody's behalf. `activities` has no write
 * policy for anyone at all, which is what stops a participant from handing
 * themselves a 40 km run.
 *
 * **Storing and evaluating are one step, in that order.** An activity that
 * is stored but never evaluated is a challenge silently not completed —
 * invisible until a participant writes in. Doing both here means every
 * source gets the behaviour for free: the webhook of story 3.5, the hourly
 * catch-up of story 3.6 and the simulated injection below all take the same
 * path.
 */

export type IngestReport = {
  received: number;
  /** Rows the database actually accepted — the rest were already there. */
  stored: number;
  /** Challenges completed by these activities. */
  completed: number;
  /** Consistency flags opened for arbitration (story 9.6). Usually zero. */
  flagged: number;
  failed: number;
};

/**
 * @returns what happened, counted. Never throws: a batch of two hundred must
 *   not be lost because one activity is malformed.
 */
export async function recordActivities(
  activities: Activity[],
): Promise<IngestReport> {
  const report: IngestReport = {
    received: activities.length,
    stored: 0,
    completed: 0,
    flagged: 0,
    failed: 0,
  };

  // Gathered across the whole batch rather than announced one by one.
  //
  // **This is what makes the grouped notification of story 6.6 possible.** A
  // long Sunday outing can settle a distance challenge, an elevation
  // challenge and a cumulative one; as the participant lived it that is one
  // event, and three notifications in a row would read as noise — which is
  // what gets notifications switched off.
  const completed = new Map<string, CompletedChallenge[]>();

  // The thresholds once for the whole batch: a hundred activities must not
  // mean a hundred reads of a single settings row.
  const thresholds = await readThresholds();

  for (const activity of activities) {
    const { outcome, id } = await storeOne(activity);

    if (outcome === "failed") {
      report.failed += 1;
      continue;
    }

    if (outcome === "duplicate") continue;

    report.stored += 1;

    // Only newly stored activities are evaluated. `applyActivity` is safe to
    // replay — the completion carries its own guard (story 4.5) — but an
    // hourly catch-up passing over a whole month would otherwise re-read
    // every open challenge for every activity it has already seen.
    const completion = await applyActivity(activity);
    report.completed += completion.completed;

    /* And the duels received from other participants (story 12.5). Called
       alongside the challenge engine rather than from inside it: the two
       share evaluators and nothing else, and one outing may legitimately
       settle the day's challenge and a received duel at once. */
    await applyActivityToDuels(activity);

    if (completion.completions.length > 0) {
      const list = completed.get(activity.profileId) ?? [];
      list.push(...completion.completions);
      completed.set(activity.profileId, list);
    }

    // **After the evaluation, and it changes nothing about it** (architecture
    // D10). The challenge is validated, the points are awarded, the card is
    // given; flagging opens a file for a human, it does not pronounce a
    // sentence. Placed last so that a failure here can cost nothing.
    if (id) {
      report.flagged += await flagActivity(id, activity, thresholds);
    }
  }

  // After the writes, never before, and never allowed to undo them: a
  // notification that fails must not turn a validated challenge back into an
  // open one. `notifyCompletions` logs its own failures and returns nothing.
  for (const [profileId, completions] of completed) {
    await notifyCompletions(profileId, completions);
  }

  return report;
}

type Outcome = "stored" | "duplicate" | "failed";

/** The stored row's identifier, needed to open a flag against it. */
type StoreResult = { outcome: Outcome; id: string | null };

async function storeOne(activity: Activity): Promise<StoreResult> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activities")
    .insert({
      profile_id: activity.profileId,
      provider: activity.provider,
      provider_activity_id: activity.id,
      name: activity.name,
      sport_family: activity.sportFamily,
      started_at: activity.startedAt,
      local_date: activity.localDate,
      distance_meters: Math.round(activity.distanceMeters),
      duration_seconds: Math.round(activity.durationSeconds),
      elevation_meters: Math.round(activity.elevationMeters),
      is_manual: activity.isManual,
      is_private: activity.isPrivate,
    })
    .select("id")
    .maybeSingle();

  if (!error) return { outcome: "stored", id: data?.id ?? null };

  // Somebody got there first — a replayed webhook, a catch-up overlapping an
  // initial import. The activity is in the game, which is all that matters.
  if (error.code === "23505") {
    await reconcileVisibility(activity);
    return { outcome: "duplicate", id: null };
  }

  console.error("[activités] enregistrement impossible", {
    provider: activity.provider,
    code: error.code,
  });

  return { outcome: "failed", id: null };
}

/**
 * Le seul champ qu'un doublon met à jour : sa visibilité.
 *
 * **Un réimport ne réécrit rien, et c'était un trou.** Une sortie déjà en
 * base revient en doublon et le reste de la ligne est laissé tel quel — ce
 * qui est voulu : réévaluer un mois d'activités à chaque rattrapage horaire
 * coûterait cher pour ne rien changer.
 *
 * Mais `is_private` est arrivé après les sorties qu'il décrit. Les lignes
 * antérieures valent « privée » faute de savoir (story 15.1), et aucun
 * réimport ne pouvait les corriger : elles revenaient toutes en doublon. Le
 * journal restait donc vide, définitivement, sans que rien ne le dise.
 *
 * Ce champ mérite ce traitement et les autres non : **il ne décide rien dans
 * le jeu**. Le mettre à jour ne peut ni valider un défi, ni en invalider un,
 * ni déplacer un rang — il change seulement ce qui est montré. C'est aussi le
 * seul dont la valeur peut légitimement changer chez le fournisseur sans que
 * la sortie elle-même ait bougé.
 *
 * Silencieux en cas d'échec : un rattrapage ne doit pas s'arrêter parce
 * qu'une visibilité n'a pas pu être mise à jour.
 */
async function reconcileVisibility(activity: Activity): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("activities")
    .update({ is_private: activity.isPrivate })
    .eq("provider", activity.provider)
    .eq("provider_activity_id", activity.id)
    .neq("is_private", activity.isPrivate);

  if (error) {
    console.error("[activités] visibilité non réconciliée", {
      code: error.code,
    });
  }
}

/**
 * An activity corrected at the provider.
 *
 * Somebody renames a run, fixes a distance their watch got wrong, changes
 * the sport. The row follows — and the challenges are offered it again,
 * because a distance corrected upwards can complete a challenge that a
 * moment ago it did not.
 *
 * **A challenge already completed is never un-completed by a correction.**
 * The evaluation only looks at open assignments (story 4.5), so a distance
 * corrected *downwards* leaves the points where they are. That is
 * deliberate: taking points back automatically, on a leaderboard, over a
 * figure somebody edited, is exactly the kind of silent decision that makes
 * a game feel arbitrary. The arbitration screen of story 4.10 is where a
 * human does it, with a reason.
 */
export async function updateActivity(activity: Activity): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activities")
    .update({
      name: activity.name,
      sport_family: activity.sportFamily,
      started_at: activity.startedAt,
      local_date: activity.localDate,
      distance_meters: Math.round(activity.distanceMeters),
      duration_seconds: Math.round(activity.durationSeconds),
      elevation_meters: Math.round(activity.elevationMeters),
      is_manual: activity.isManual,
      // Repassée en publique sur Strava ? Le journal la montre au passage
      // suivant. L'inverse aussi, et c'est le sens qui compte : masquer une
      // sortie chez le fournisseur doit la retirer d'ici.
      is_private: activity.isPrivate,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", activity.provider)
    .eq("provider_activity_id", activity.id)
    .select("id");

  if (error) {
    console.error("[activités] mise à jour impossible", {
      provider: activity.provider,
      code: error.code,
    });
    return false;
  }

  // Nothing to update means we never had it — a correction can arrive for an
  // activity that predates the link. Storing it now is the useful answer.
  if ((data ?? []).length === 0) {
    const report = await recordActivities([activity]);
    return report.stored > 0;
  }

  const completion = await applyActivity(activity);
  await applyActivityToDuels(activity);

  // A correction can complete a challenge — a distance the watch got wrong,
  // fixed upwards. It deserves the same announcement as a fresh activity.
  if (completion.completions.length > 0) {
    await notifyCompletions(activity.profileId, completion.completions);
  }

  return true;
}

/**
 * An activity deleted at the provider.
 *
 * The row goes. **The challenges it validated stay validated**, and that is a
 * decision rather than an oversight: deleting an activity after it completed
 * a challenge is a plausible way to cheat, but tidying up one's own Strava is
 * far more common — and un-completing a challenge three days later, silently,
 * would be the worse mistake. Architecture D10 says it plainly: flag, never
 * reject automatically. The line logged here is what a human acts on.
 */
export async function removeActivity(
  provider: Activity["provider"],
  providerActivityId: string,
): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activities")
    .delete()
    .eq("provider", provider)
    .eq("provider_activity_id", providerActivityId)
    .select("id, profile_id");

  if (error) {
    console.error("[activités] suppression impossible", {
      provider,
      code: error.code,
    });
    return false;
  }

  const removed = (data ?? []).length > 0;

  if (removed) {
    console.info("[activités] activité supprimée chez le fournisseur", {
      provider,
      activity: providerActivityId,
    });
  }

  return removed;
}

/** How many activities a participant has, for the connection screen. */
export async function countActivities(profileId: string): Promise<number> {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (error) {
    console.error("[activités] comptage impossible", { code: error.code });
    return 0;
  }

  return count ?? 0;
}

/**
 * How many of somebody's outings were typed in rather than recorded.
 *
 * Used to say so on their own screen (story 9.8 AC 3). An outing that comes
 * through and validates nothing, with no explanation, is a message to
 * support — and the participant is right to send it: from where they stand,
 * the game simply did not react.
 */
export async function countManualActivities(
  profileId: string,
): Promise<number> {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("is_manual", true);

  if (error) {
    console.error("[activités] comptage des saisies manuelles impossible", {
      code: error.code,
    });
    return 0;
  }

  return count ?? 0;
}
