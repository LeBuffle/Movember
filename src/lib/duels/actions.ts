"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { notifyDuelReceived } from "@/lib/duels/notify";
import { SEND_MESSAGES, sendDuel, type SendStatus } from "@/lib/duels/send";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DuelFormState = {
  message?: string;
  /** Set on success, so the screen can say what just happened. */
  success?: string;
};

const BOARD = "/jeu/defis-joueurs";

/**
 * Sending a duel (story 12.3), and answering one for free (story 12.6).
 *
 * **The sender comes from the session, the target from the form.** This is
 * the only paying gesture in the project where the browser chooses something
 * other than a product: it chooses a person. So the target is checked
 * server-side at every send — that they are registered, active, not
 * suspended, not the sender, and that they have not switched duels off.
 *
 * All of those checks live in `send_duel`, in the database, alongside the
 * debit. Not because it is elegant: because a check made here and a debit
 * made there are two writes that can disagree, and the disagreement always
 * costs somebody a credit.
 */
export async function sendDuelAction(
  _previous: DuelFormState,
  formData: FormData,
): Promise<DuelFormState> {
  const receiverId = String(formData.get("joueur") ?? "");
  const duelTypeId = String(formData.get("defi") ?? "");
  const parentDuelId = String(formData.get("riposte") ?? "") || null;

  if (!receiverId || !duelTypeId) {
    return { message: "Choisissez un participant et un défi." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`${ROUTES.signIn}?suite=${BOARD}`);

  const admin = createAdminClient();

  const { data: edition } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return { message: "L’édition n’est pas ouverte. Réessayez plus tard." };
  }

  // The sender has to be playing too. Checked here rather than in the database
  // function so the refusal can name the reason: somebody who has not paid
  // their registration needs to be told that, not "impossible".
  const { data: registration } = await admin
    .from("registrations")
    .select("status")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  if (registration?.status !== "active") {
    return {
      message:
        "Les défis entre joueurs sont réservés aux participants inscrits. Finalisez d’abord votre inscription.",
    };
  }

  const outcome = await sendDuel({
    senderId: user.id,
    receiverId,
    editionId: edition.id,
    duelTypeId,
    parentDuelId,
  });

  if (outcome.status !== "ok") {
    return {
      message: SEND_MESSAGES[outcome.status as Exclude<SendStatus, "ok">],
    };
  }

  /* After the write, and it may not undo it. A notification that fails must
     never turn a sent duel back into an unsent one — the credit is spent and
     the duel exists (same rule as story 6.5 AC 7). */
  if (outcome.duelId) {
    await notifyDuelReceived(outcome.duelId);
  }

  revalidatePath(BOARD);

  return {
    success: parentDuelId
      ? "Riposte envoyée. Elle ne vous a rien coûté."
      : "Défi envoyé. Il a 24 heures pour le relever.",
  };
}

/**
 * The "ne pas me défier" switch (story 12.4, decision P9).
 *
 * Written through the participant's own session rather than with the service
 * key: it is their column, on their row, and row level security is exactly
 * the right authority for it. Nothing here can affect anybody else.
 */
export async function setDuelOptOut(
  _previous: DuelFormState,
  formData: FormData,
): Promise<DuelFormState> {
  const optOut = formData.get("recevoir") === null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.signIn);

  const { error } = await supabase
    .from("profiles")
    .update({ duels_opt_out: optOut })
    .eq("id", user.id);

  if (error) {
    console.error("[défis-joueurs] réglage non enregistré", {
      code: error.code,
    });
    return {
      message: "Le réglage n’a pas pu être enregistré. Réessayez.",
    };
  }

  revalidatePath("/mon-compte");
  revalidatePath(BOARD);

  return {
    success: optOut
      ? "Vous ne recevrez plus de défis. Vous pouvez toujours en envoyer."
      : "Vous pouvez de nouveau recevoir des défis.",
  };
}
