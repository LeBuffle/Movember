"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deciding a challenge by hand.
 *
 * **The relief valve of the whole engine.** An evaluator that is too strict,
 * an activity that synced badly, a watch that cut out mid-run: somebody has
 * to be able to decide, in November, without waiting for a fix to be written
 * and deployed. Without this screen, every edge case becomes a development
 * emergency in the middle of the month.
 *
 * Three things follow from what an arbitration actually does — it moves
 * somebody's points, and therefore somebody else's rank.
 *
 * **A reason is required, and it is not bureaucracy.** Two months later,
 * "why was this challenge validated by hand?" must have an answer written by
 * whoever decided, not reconstructed from a timestamp.
 *
 * **The trace is written before the change.** `logAdminAction` returns a
 * boolean rather than throwing, and story 1.10 left the decision to the
 * caller: here, as for a refund, no trace means no arbitration. An entry
 * with no follow-up is itself informative; points that moved with nobody's
 * name on them are not.
 *
 * **It goes through the service key, after the role check.**
 * `challenge_assignments` has no write policy for anyone at all — that is
 * what stops a participant awarding themselves the month — so the only way
 * in is server-side, and this is the only door.
 */

export type ArbitrationFormState = {
  errors?: Record<string, string>;
  message?: string;
};

/** Long enough to be a sentence. "ok" is not a reason. */
const MINIMUM_REASON = 10;

export async function arbitrateChallenge(
  _previous: ArbitrationFormState,
  formData: FormData,
): Promise<ArbitrationFormState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!assignmentId) return { message: "Défi introuvable." };

  // No default. "Valider" and "invalider" are opposite decisions with
  // opposite consequences on the leaderboard, and a pre-selected one would
  // be a decision taken by whoever wrote the form.
  if (decision !== "validate" && decision !== "invalidate") {
    return { errors: { decision: "Choisissez de valider ou d’invalider." } };
  }

  if (reason.length < MINIMUM_REASON) {
    return {
      errors: {
        reason:
          "Indiquez le motif en une phrase : il sera lu par quelqu’un qui n’était pas là.",
      },
    };
  }

  const db = createAdminClient();

  const { data: assignment } = await db
    .from("challenge_assignments")
    .select("id, profile_id, status, points_awarded, challenges (points)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) return { message: "Ce défi n’existe pas." };

  const previous = assignment as unknown as {
    id: string;
    profile_id: string;
    status: "open" | "completed" | "missed";
    points_awarded: number | null;
    challenges: { points: number } | null;
  };

  const validating = decision === "validate";

  if (validating && previous.status === "completed") {
    return { message: "Ce défi est déjà validé." };
  }

  if (!validating && previous.status === "missed") {
    return { message: "Ce défi est déjà invalidé." };
  }

  // The trace, before the change. If it does not save, nothing moves.
  const traced = await logAdminAction({
    action: validating ? "challenge.validated" : "challenge.invalidated",
    targetTable: "challenge_assignments",
    targetId: previous.id,
    payload: {
      reason,
      previous_status: previous.status,
      previous_points: previous.points_awarded,
    },
  });

  if (!traced) {
    return {
      message:
        "L’arbitrage n’a pas été appliqué : sa trace n’a pas pu être enregistrée. Réessayez.",
    };
  }

  const now = new Date().toISOString();

  const { data: changed, error } = await db
    .from("challenge_assignments")
    .update(
      validating
        ? {
            status: "completed",
            completed_at: now,
            // The catalogue's value taken now, exactly as an automatic
            // completion does. A challenge decided by hand is worth what the
            // challenge is worth — nobody sets a price per case.
            points_awarded: previous.challenges?.points ?? 0,
            arbitrated_at: now,
            arbitrated_by: admin.id,
          }
        : {
            // `missed` rather than `open`. Reopening it would let the very
            // activity that was just rejected complete it again on the next
            // evaluation — an invalidation that undoes itself.
            status: "missed",
            completed_at: null,
            points_awarded: null,
            arbitrated_at: now,
            arbitrated_by: admin.id,
          },
    )
    .eq("id", previous.id)
    // The guard is carried by the write itself, not by the read above: two
    // administrators on the same challenge at the same moment must not both
    // succeed.
    .eq("status", previous.status)
    // Asked back, so that "nothing changed" can be told apart from "it
    // worked". Announcing a success that did not happen is how two people
    // end up believing opposite things about the same challenge.
    .select("id");

  if (error) {
    console.error("[arbitrage] écriture impossible", {
      assignment: previous.id,
      code: error.code,
    });

    await logAdminAction({
      action: "challenge.arbitration_failed",
      targetTable: "challenge_assignments",
      targetId: previous.id,
      payload: { reason },
    });

    return {
      message:
        "L’arbitrage n’a pas pu être enregistré. Rien n’a été modifié ; réessayez.",
    };
  }

  if ((changed ?? []).length === 0) {
    // Somebody else decided this challenge between the read and the write.
    // The journal entry above stays: an intention that arrived second is
    // exactly the kind of thing worth being able to read afterwards.
    return {
      message:
        "Ce défi vient d’être arbitré par quelqu’un d’autre. Rechargez la page pour voir la décision en place.",
    };
  }

  revalidatePath("/admin/defis/arbitrage");
  // The participant's own screens read the assignment they were shown a
  // moment ago; without this they would keep showing the old verdict until
  // the cache expired.
  revalidatePath("/jeu");
  revalidatePath("/jeu/historique");

  redirect(
    `/admin/defis/arbitrage?participant=${previous.profile_id}&arbitre=1`,
  );
}
