"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

/**
 * Setting a participant aside, and bringing them back (story 8.7).
 *
 * **Suspending is not refunding.** The registration and the payment are left
 * untouched: what becomes of the money is a separate decision, taken
 * elsewhere (story 2.8) by somebody who has thought about it. Rolling the two
 * into one gesture means taking the second decision without meaning to.
 *
 * **The reason is required**, and the database refuses a suspension without
 * one. It is a decision about a person: it has to be explainable three weeks
 * later, by somebody who did not take it.
 *
 * **Reversible**, and lifting is traced exactly like setting. A suspension
 * placed in the urgency of a Sunday has to be liftable on Monday without
 * leaving a mark in the game.
 */

export type SuspensionState = {
  message?: string;
  done?: boolean;
};

const REFUSED: SuspensionState = {
  message: "Cette page n’est plus accessible. Reconnectez-vous.",
};

export async function suspendParticipant(
  _previous: SuspensionState,
  formData: FormData,
): Promise<SuspensionState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) return { message: "Participant introuvable." };

  if (reason.length < 3 || reason.length > 500) {
    return {
      message:
        "Un motif est obligatoire, entre 3 et 500 caractères. Il devra pouvoir être relu et compris par quelqu’un qui n’a pas pris la décision.",
    };
  }

  // An administrator suspending themselves would lock the organisation out of
  // its own game in the middle of November, and the screen that lifts it is
  // behind the same door.
  if (id === admin.id) {
    return {
      message:
        "Vous ne pouvez pas vous suspendre vous-même : l’écran qui lève une suspension est derrière la même porte.",
    };
  }

  const supabase = await createClient();

  // The guard is carried by the write: `is("suspended_at", null)` means a
  // second press, or two volunteers on two phones, cannot overwrite the first
  // reason with a second one.
  const { data, error } = await supabase
    .from("profiles")
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
      suspended_by: admin.id,
    })
    .eq("id", id)
    .is("suspended_at", null)
    .select("id, display_name");

  if (error) {
    console.error("[suspension] pose impossible", { code: error.code });
    return {
      message:
        "La suspension n’a pas pu être enregistrée. Rien n’a changé pour ce participant.",
    };
  }

  if ((data ?? []).length === 0) {
    return { message: "Ce participant est déjà suspendu." };
  }

  await logAdminAction({
    action: "participant.suspended",
    targetTable: "profiles",
    targetId: id,
    // The pseudonym rather than the e-mail: an audit entry outlives the
    // account it refers to.
    payload: { pseudonyme: data![0]!.display_name, motif: reason },
  });

  revalidatePath(`/admin/participants/${id}`);
  revalidatePath("/admin/participants");

  return { done: true };
}

export async function liftSuspension(
  _previous: SuspensionState,
  formData: FormData,
): Promise<SuspensionState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { message: "Participant introuvable." };

  const supabase = await createClient();

  // The reason is cleared with the suspension, because the constraint refuses
  // one without the other — and because a reason left behind would read, on
  // the next screen, as a suspension still in force.
  const { data, error } = await supabase
    .from("profiles")
    .update({
      suspended_at: null,
      suspension_reason: null,
      suspended_by: null,
    })
    .eq("id", id)
    .not("suspended_at", "is", null)
    .select("id, display_name");

  if (error) {
    console.error("[suspension] levée impossible", { code: error.code });
    return { message: "La suspension n’a pas pu être levée." };
  }

  if ((data ?? []).length === 0) {
    return { message: "Ce participant n’est pas suspendu." };
  }

  await logAdminAction({
    action: "participant.reinstated",
    targetTable: "profiles",
    targetId: id,
    payload: { pseudonyme: data![0]!.display_name },
  });

  revalidatePath(`/admin/participants/${id}`);
  revalidatePath("/admin/participants");

  return { done: true };
}
