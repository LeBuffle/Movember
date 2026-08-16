"use server";

import { verifyUnsubscribe } from "@/lib/notifications/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Unsubscribing from the link at the bottom of an e-mail.
 *
 * **No session is involved, and that is the requirement** (story 6.4 AC 4).
 * Somebody who wants the e-mails to stop is by definition somebody who does
 * not want to deal with us; asking them to log in first is how an unsubscribe
 * link becomes a spam report — and a spam report costs the sending domain far
 * more than one participant.
 *
 * The signed token is therefore the only proof, and it is checked before
 * anything is written. Writing goes through the service key because there is
 * no session to write with; the identity comes from the token and from
 * nowhere else.
 *
 * It switches off **the e-mail channel**, not the categories. Somebody
 * pressing this wants their inbox left alone — not to stop playing. Their
 * notifications on the phone, if they have any, keep working, and everything
 * is reversible from their account.
 */

export type UnsubscribeState = {
  done?: boolean;
  message?: string;
};

export async function unsubscribeFromEmails(
  _previous: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const token = String(formData.get("jeton") ?? "").trim();
  const checked = verifyUnsubscribe(token);

  if (!checked.ok) {
    return {
      message:
        checked.reason === "expired"
          ? "Ce lien a expiré. Ouvrez « Mon compte » puis « Mes notifications » pour couper les e-mails."
          : "Ce lien n’est pas valide. Ouvrez « Mon compte » puis « Mes notifications » pour couper les e-mails.",
    };
  }

  const admin = createAdminClient();

  const { error } = await admin.from("notification_preferences").upsert(
    {
      profile_id: checked.profileId,
      channel_email: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );

  if (error) {
    console.error("[notifications] désabonnement non enregistré", {
      code: error.code,
    });

    return {
      message:
        "Le désabonnement n’a pas pu être enregistré. Réessayez dans un instant.",
    };
  }

  return { done: true };
}
