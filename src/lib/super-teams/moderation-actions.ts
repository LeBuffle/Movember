"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import {
  markLogoReviewed,
  removeLogoAsAdmin,
  type LogoOwnerKind,
} from "@/lib/super-teams/moderation";

/**
 * The two gestures of the moderation screen (story 14.6).
 *
 * Both are journalised. A removal is invisible to everybody except the
 * captain who receives the message, so the journal is the only way to answer
 * "who took this down, and when" — which is the question that arrives when a
 * removal is contested.
 */

export type ModerationState = { message?: string; done?: boolean };

function readTarget(formData: FormData): {
  kind: LogoOwnerKind;
  id: string;
} | null {
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "").trim();

  if (!id) return null;
  if (kind !== "equipe" && kind !== "super-equipe") return null;

  return { kind, id };
}

export async function removeLogoAction(
  _previous: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const target = readTarget(formData);
  if (!target) return { message: "Logo introuvable." };

  const outcome = await removeLogoAsAdmin(target.kind, target.id);

  if (!outcome.ok) {
    return {
      message:
        outcome.reason === "not-found"
          ? "Ce logo a déjà été retiré."
          : "Le retrait n’a pas abouti. Réessayez dans un instant.",
    };
  }

  await logAdminAction({
    action: "logo.removed",
    targetTable: target.kind === "equipe" ? "teams" : "super_teams",
    targetId: target.id,
  });

  revalidatePath("/admin/logos");

  return {
    done: true,
    message:
      "Logo retiré. Le capitaine a été prévenu et peut en envoyer un autre.",
  };
}

export async function markLogoReviewedAction(
  _previous: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const target = readTarget(formData);
  if (!target) return { message: "Logo introuvable." };

  const outcome = await markLogoReviewed(target.kind, target.id);
  if (!outcome.ok) return { message: "Ce logo n’existe plus." };

  revalidatePath("/admin/logos");

  return { done: true };
}
