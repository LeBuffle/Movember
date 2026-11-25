"use server";

import { revalidatePath } from "next/cache";

import { unlinkAccount } from "@/lib/activities/connection";
import { CONSENT_VERSION } from "@/lib/activities/consent";
import { createClient } from "@/lib/supabase/server";

/**
 * Granting and withdrawing consent.
 *
 * Written through the participant's own session — **not** the service key.
 * Row level security is what guarantees a consent is filed under the name of
 * whoever gave it, and it keeps that guarantee even if this file were later
 * called from somewhere careless. Consenting on somebody else's behalf is the
 * one thing a consent record must never allow.
 *
 * Both directions append a row; neither edits one. A consent record that can
 * be corrected after the fact proves nothing.
 */

export type ConsentFormState = {
  message?: string;
  saved?: boolean;
};

export async function grantActivityConsent(
  _previous: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  // The checkbox is never pre-ticked, and the server checks it again: a
  // required attribute in the browser is a courtesy, not a control.
  if (formData.get("consent") !== "on") {
    return {
      message:
        "Cochez la case pour autoriser la récupération de vos activités sportives.",
    };
  }

  return record("granted");
}

export async function withdrawActivityConsent(
  _previous: ConsentFormState,
  _formData: FormData,
): Promise<ConsentFormState> {
  return record("withdrawn");
}

async function record(action: "granted" | "withdrawn") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Votre session a expiré. Reconnectez-vous." };
  }

  const { error } = await supabase.from("activity_consents").insert({
    profile_id: user.id,
    action,
    // A withdrawal withdraws whatever was in force; only a grant names a
    // version.
    version: action === "granted" ? CONSENT_VERSION : null,
  });

  if (error) {
    console.error("[consentement] enregistrement impossible", {
      action,
      code: error.code,
    });

    return {
      message: "Votre choix n’a pas pu être enregistré. Réessayez.",
    };
  }

  // Withdrawing consent unlinks the sporting account (story 3.2 AC 7).
  // Keeping the link alive without a consent would mean holding a token we
  // have no basis to use — and it would keep collecting activities from
  // somebody who just said stop.
  if (action === "withdrawn") {
    await unlinkAccount(user.id);
  }

  revalidatePath("/mon-compte");
  revalidatePath("/mon-compte/activites");

  return { saved: true };
}
