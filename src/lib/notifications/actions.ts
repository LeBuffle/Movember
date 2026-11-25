"use server";

import { revalidatePath } from "next/cache";

import {
  removeSubscription,
  saveSubscription,
} from "@/lib/notifications/subscriptions";

/**
 * What the browser sends once the participant has agreed.
 *
 * The subscription object is produced by the browser and posted back as
 * plain fields rather than as a blob: the shape is checked here, so a
 * malformed subscription is refused with a sentence instead of stored and
 * discovered on the morning of the first send.
 */

export type PushState = {
  ok?: boolean;
  message?: string;
};

const REFUSED: PushState = {
  message: "Votre session a expiré. Reconnectez-vous et réessayez.",
};

export async function registerPushSubscription(
  _previous: PushState,
  formData: FormData,
): Promise<PushState> {
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  const p256dh = String(formData.get("p256dh") ?? "").trim();
  const auth = String(formData.get("auth") ?? "").trim();
  const userAgent = String(formData.get("userAgent") ?? "").trim();

  // An endpoint has to be an address the sender will call. Anything else is
  // refused here rather than at three in the morning inside a batch.
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return {
      message:
        "Votre navigateur n’a pas fourni un abonnement exploitable. Réessayez, ou depuis un autre navigateur.",
    };
  }

  const saved = await saveSubscription({
    endpoint,
    p256dh,
    auth,
    userAgent: userAgent || null,
  });

  if (!saved) return REFUSED;

  revalidatePath("/mon-compte/notifications");
  return { ok: true };
}

export async function forgetPushSubscription(
  _previous: PushState,
  formData: FormData,
): Promise<PushState> {
  const endpoint = String(formData.get("endpoint") ?? "").trim();
  if (!endpoint) return { message: "Aucun appareil à retirer." };

  const removed = await removeSubscription(endpoint);
  if (!removed) return REFUSED;

  revalidatePath("/mon-compte/notifications");
  return { ok: true };
}
