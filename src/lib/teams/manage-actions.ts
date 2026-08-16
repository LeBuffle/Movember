"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { isTeamKind } from "@/lib/teams/kinds";
import {
  adminAssignCaptain,
  adminCreateTeam,
  handOverCaptaincy,
  leaveTeam,
  removeMember,
  type ManageOutcome,
} from "@/lib/teams/manage";

/**
 * The gestures a captain — or the organisation — makes about a team.
 *
 * Every refusal is a sentence with something to do in it. "Vous êtes
 * capitaine" is not an answer; "transmettez d'abord le rôle, puis quittez"
 * is.
 */

export type ManageState = {
  message?: string;
  done?: boolean;
  fieldErrors?: Record<string, string>;
  /** Shown once, after the organisation creates a team. */
  joinCode?: string;
};

function explain(outcome: Extract<ManageOutcome, { ok: false }>): ManageState {
  switch (outcome.reason) {
    case "unauthenticated":
      return { message: "Reconnectez-vous pour continuer." };
    case "not-in-team":
      return { message: "Vous ne faites partie d’aucune équipe." };
    case "not-captain":
      return { message: "Seul le capitaine peut faire cela." };
    case "captain-must-hand-over":
      return {
        message:
          "Vous êtes capitaine : transmettez d’abord le rôle à quelqu’un d’autre. Une équipe sans capitaine ne peut plus inviter personne.",
      };
    case "not-a-member":
      return { message: "Cette personne ne fait pas partie de l’équipe." };
    default:
      return {
        message: "L’opération n’a pas abouti. Réessayez dans un instant.",
      };
  }
}

export async function leaveTeamAction(
  _previous: ManageState,
  _formData: FormData,
): Promise<ManageState> {
  const outcome = await leaveTeam();

  if (!outcome.ok) return explain(outcome);

  revalidatePath("/jeu/equipe");

  return {
    done: true,
    message:
      outcome.note === "team-dissolved"
        ? "Vous avez quitté votre équipe, et comme vous en étiez le dernier membre, elle a été dissoute. Vos défis, vos points et vos cartes ne bougent pas."
        : "Vous avez quitté votre équipe. Vos défis, vos points et vos cartes ne bougent pas.",
  };
}

export async function removeMemberAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  if (!profileId) return { message: "Membre introuvable." };

  const outcome = await removeMember(profileId);
  if (!outcome.ok) return explain(outcome);

  revalidatePath("/jeu/equipe");
  return { done: true };
}

export async function handOverAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  if (!profileId) return { message: "Membre introuvable." };

  const outcome = await handOverCaptaincy(profileId);
  if (!outcome.ok) return explain(outcome);

  revalidatePath("/jeu/equipe");
  return {
    done: true,
    message:
      "Le rôle de capitaine a été transmis. Vous restez dans l’équipe comme membre.",
  };
}

/**
 * The organisation creating a team for a company (FR78).
 *
 * The administrator is its captain on paper until the company's contact has
 * an account — a company asks for a team before anybody has registered. The
 * code is shown **once**, right after creation, because that is the moment it
 * gets forwarded.
 */
export async function adminCreateTeamAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "entreprise");

  if (name.length < 2 || name.length > 60) {
    return {
      fieldErrors: { name: "Le nom doit faire entre 2 et 60 caractères." },
    };
  }

  if (!isTeamKind(kind)) {
    return { fieldErrors: { kind: "Choisissez un type d’équipe." } };
  }

  const outcome = await adminCreateTeam(name, kind, admin.id);

  if (!outcome.ok) {
    if (outcome.reason === "name-taken") {
      return { fieldErrors: { name: "Ce nom d’équipe est déjà pris." } };
    }
    if (outcome.reason === "bad-name") {
      return {
        fieldErrors: {
          name: "Ce nom ne contient pas assez de lettres ou de chiffres.",
        },
      };
    }

    return { message: "L’équipe n’a pas pu être créée." };
  }

  await logAdminAction({
    action: "team.created",
    targetTable: "teams",
    targetId: outcome.teamId,
    payload: { name, kind },
  });

  revalidatePath("/admin/equipes");
  return { done: true, joinCode: outcome.joinCode };
}

export async function adminAssignCaptainAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const teamId = String(formData.get("teamId") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!teamId || !profileId)
    return { message: "Équipe ou membre introuvable." };

  const outcome = await adminAssignCaptain(teamId, profileId);
  if (!outcome.ok) return explain(outcome);

  await logAdminAction({
    action: "team.captain_assigned",
    targetTable: "teams",
    targetId: teamId,
    payload: { profile_id: profileId },
  });

  revalidatePath("/admin/equipes");
  return { done: true };
}
