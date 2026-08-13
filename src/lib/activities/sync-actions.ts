"use server";

import { revalidatePath } from "next/cache";

import { getConnection, unlinkAccount } from "@/lib/activities/connection";
import { readAccessToken } from "@/lib/activities/connection";
import { activitySource } from "@/lib/activities/sources";
import { syncParticipant } from "@/lib/activities/sync";
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

  const outcome = await syncParticipant(user.id);

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

    return {
      message:
        outcome.reason === "broken"
          ? "Strava a refusé l’accès. Reconnectez votre compte."
          : "Strava n’a pas répondu. Ce n’est pas de votre fait : réessayez dans quelques minutes.",
    };
  }

  return { stored: outcome.stored };
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
