"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { getConnection, unlinkAccount } from "@/lib/activities/connection";
import { readAccessToken } from "@/lib/activities/connection";
import { activitySource } from "@/lib/activities/sources";
import {
  importInitialActivities,
  syncParticipant,
} from "@/lib/activities/sync";
import { createClient } from "@/lib/supabase/server";

/**
 * What a participant can do to their own link.
 *
 * Two buttons, and the second one is the important one: **disconnecting has
 * to reach Strava, not only our database.** Clearing our token alone leaves
 * the authorisation live in their Strava account — they believe they cut the
 * link, and they have not. Somebody who disconnects wants it to stop for
 * good.
 */

export type SyncFormState = {
  message?: string;
  stored?: number;
  /**
   * The precise reason, for the organisation only.
   *
   * **Because the person testing cannot read the server logs.** The Product
   * Owner runs the rehearsal from a phone; "Strava n'a pas répondu" is the
   * right sentence for a participant and useless for whoever has to repair
   * it. Shown to administrators, and to nobody else.
   */
  detail?: string;
};

/**
 * How long between two manual resynchronisations.
 *
 * A button that relaunches is a button that reassures, even when it changes
 * nothing — which is exactly why it needs a limit. Somebody waiting for an
 * activity will press it ten times, and ten calls per person eat the
 * application's quota for everybody.
 */
const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

export async function resynchronise(
  _previous: SyncFormState,
  _formData: FormData,
): Promise<SyncFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { message: "Votre session a expiré. Reconnectez-vous." };

  const connection = await getConnection(user.id);

  if (!connection) {
    return { message: "Aucun compte sportif n’est relié." };
  }

  if (connection.status === "broken") {
    return {
      message:
        "La liaison est rompue : reconnectez votre compte, la synchronisation reprendra ensuite.",
    };
  }

  const last = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt).getTime()
    : 0;

  if (Date.now() - last < RESYNC_INTERVAL_MS) {
    return {
      message:
        "Vos sorties viennent d’être vérifiées. Réessayez dans quelques minutes — une activité met parfois un moment à apparaître sur Strava.",
    };
  }

  // **Un rattrapage de deux jours ne rattrape pas une liaison neuve.**
  // L'import complet ne tourne qu'au moment où le compte est relié : s'il
  // échoue ce jour-là — Strava indisponible, édition pas encore ouverte — le
  // participant ne récupère jamais son début de mois, et aucun bouton ne le
  // rattrape. Tant que rien n'a jamais été rapatrié, on reprend donc depuis
  // le début de l'édition plutôt que depuis avant-hier.
  const outcome = connection.lastSyncedAt
    ? await syncParticipant(user.id)
    : await importInitialActivities(user.id);

  revalidatePath("/mon-compte/activites");
  revalidatePath("/jeu");

  if (!outcome.ok) {
    // « Avant l'édition » n'est pas une panne, et le dire évite la seule
    // conclusion que le participant tirerait autrement : que la liaison ne
    // marche pas.
    if (outcome.reason === "before-edition") {
      return {
        message:
          "Votre compte est bien relié. Le jeu n’a pas encore commencé : les sorties seront récupérées à partir du premier jour de l’édition.",
      };
    }

    if (outcome.reason === "busy") {
      return {
        message:
          "Une vérification est déjà en cours pour votre compte. Laissez-lui une minute, puis réessayez.",
        detail: await adminDetail("busy"),
      };
    }

    return {
      message:
        outcome.reason === "broken"
          ? "Strava a refusé l’accès. Reconnectez votre compte."
          : "Strava n’a pas répondu. Ce n’est pas de votre fait : réessayez dans quelques minutes.",
      detail: await adminDetail(outcome.reason),
    };
  }

  return { stored: outcome.stored };
}

/**
 * The technical reason, for administrators only.
 *
 * @returns `undefined` for everybody else, so the participant's screen keeps
 *   saying what a participant can act on.
 */
async function adminDetail(reason: string): Promise<string | undefined> {
  const admin = await requireAdmin();
  if (!admin) return undefined;

  return `Raison technique : ${reason}. Le détail — code HTTP de Strava compris — est dans le journal du serveur, préfixe « [strava] ».`;
}

/**
 * Unlinking, at Strava as well as here.
 *
 * The game keeps what was earned: a challenge completed on 4 November stays
 * completed if the account is unlinked on the 12th. Its points were copied
 * onto the assignment when it was awarded (story 4.1), so taking them back
 * would change everybody's ranking over one person's private decision.
 */
export async function disconnectAccount(
  _previous: SyncFormState,
  _formData: FormData,
): Promise<SyncFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { message: "Votre session a expiré. Reconnectez-vous." };

  const source = activitySource("strava");
  const stored = await readAccessToken(user.id);

  // Strava first. If our row went first and the call then failed, the
  // participant would be told they are disconnected while the authorisation
  // is still live — the one outcome this must never produce.
  if (source && stored) {
    const revoked = await source.revoke(stored.token);

    if (!revoked.ok && revoked.reason === "unavailable") {
      return {
        message:
          "Strava n’a pas répondu : votre compte est toujours relié. Réessayez dans quelques minutes.",
      };
    }
  }

  await unlinkAccount(user.id);

  revalidatePath("/mon-compte/activites");
  revalidatePath("/jeu");

  return {};
}
