"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Settling a flagged case (story 9.7).
 *
 * Two outcomes, and both are decisions:
 *
 * - **accepted** — the outing stands. A cyclist really did average 55 km/h
 *   downhill, an ultra-runner really was out for fourteen hours.
 * - **dismissed** — the outing is set aside as not credible.
 *
 * **Dismissing does not invalidate the challenge**, and the separation is
 * deliberate — the same one as suspension and refund. Judging an activity and
 * taking points off somebody are two decisions; rolling them into one button
 * means taking the second without meaning to. The arbitration screen of story
 * 4.10 is where a human removes points, with its own reason and its own trace.
 *
 * Written with the service key because the table carries no write policy for
 * anybody: row level security filters ROWS, not COLUMNS, and whoever could
 * write `status` could dismiss their own flag. The role is checked here.
 */

export type ArbitrationState = {
  message?: string;
  done?: boolean;
};

const REFUSED: ArbitrationState = {
  message: "Cette page n’est plus accessible. Reconnectez-vous.",
};

export async function resolveFlag(
  _previous: ArbitrationState,
  formData: FormData,
): Promise<ArbitrationState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) return { message: "Signalement introuvable." };

  if (decision !== "accepted" && decision !== "dismissed") {
    return { message: "Décision inconnue." };
  }

  if (reason.length < 3 || reason.length > 500) {
    return {
      message:
        "Un motif est obligatoire, entre 3 et 500 caractères. Il sera relu par quelqu’un qui n’a pas pris la décision.",
    };
  }

  const supabase = createAdminClient();

  // The guard is carried by the write: a case already settled is never
  // settled a second time, and two volunteers on two phones cannot overwrite
  // each other's reason.
  const { data, error } = await supabase
    .from("activity_flags")
    .update({
      status: decision,
      resolution_reason: reason,
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, rule, profile_id");

  if (error) {
    console.error("[arbitrage] décision non enregistrée", {
      code: error.code,
    });
    return { message: "La décision n’a pas pu être enregistrée." };
  }

  if ((data ?? []).length === 0) {
    return { message: "Ce cas a déjà été tranché." };
  }

  await logAdminAction({
    action:
      decision === "accepted" ? "activity.accepted" : "activity.dismissed",
    targetTable: "activity_flags",
    targetId: id,
    payload: { regle: data![0]!.rule, motif: reason },
  });

  revalidatePath("/admin/arbitrage");

  return { done: true };
}
