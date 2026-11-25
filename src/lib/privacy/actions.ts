"use server";

import { redirect } from "next/navigation";

import { deleteAccount } from "@/lib/privacy/deletion";
import { createClient } from "@/lib/supabase/server";

export type DeletionFormState = { message?: string };

/**
 * The participant asks for their account to be erased (story 11.2).
 *
 * **The identity comes from the session, never from the form.** There is no
 * identifier in this form and there must never be one: an action that took a
 * profile identifier from a submitted field would be a way to erase somebody
 * else's account, and it would look exactly like this one.
 *
 * The confirmation asked of the browser is retyping the pseudonym. It is a
 * courtesy, not a control — the server does not check it, because a control
 * that can be bypassed by the same person who owns the account protects
 * nobody. What it protects against is a misplaced thumb, and that is worth
 * having.
 */
export async function deleteMyAccount(
  _previous: DeletionFormState,
  _formData: FormData,
): Promise<DeletionFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Votre session a expiré. Reconnectez-vous." };
  }

  const outcome = await deleteAccount(user.id);

  if (!outcome.ok) {
    switch (outcome.reason) {
      case "is-admin":
        return {
          message:
            "Ce compte est un compte d’organisation : son effacement se fait à la main, car le journal du back-office doit conserver l’auteur de chaque geste.",
        };
      case "provider-unavailable":
        return {
          message:
            "Strava n’a pas répondu : rien n’a été supprimé, votre compte est intact. Réessayez dans quelques minutes.",
        };
      default:
        return {
          message:
            "L’effacement n’a pas pu être mené à son terme. Écrivez-nous : nous le terminons à la main.",
        };
    }
  }

  /* Signing out after the fact rather than before: the session is what
     established who was asking. Its cookie now points at nothing, and leaving
     it in the browser would produce a signed-in state with no profile behind
     it — every page would then fail in its own way. */
  await supabase.auth.signOut();

  redirect("/compte-supprime");
}
