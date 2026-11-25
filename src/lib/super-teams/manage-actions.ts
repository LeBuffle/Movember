"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import {
  assignSuperCaptain,
  attachTeam,
  createSuperTeam,
  deleteSuperTeam,
  detachTeam,
  renameSuperTeam,
  type SuperTeamOutcome,
} from "@/lib/super-teams/manage";

/**
 * The five gestures the organisation makes about a federation (story 14.2).
 *
 * Every refusal is a sentence with something to do in it. "Impossible" is not
 * an answer; "cette équipe appartient déjà à une autre super-équipe —
 * détachez-la d'abord" is.
 *
 * Every one of them is journalised. That is not paperwork: detaching a team
 * is invisible to the team itself until somebody notices their internal
 * ranking has gone, and the journal is the only way to answer "who did this,
 * and when".
 */

export type SuperTeamState = {
  message?: string;
  done?: boolean;
  fieldErrors?: Record<string, string>;
};

const MAX_DESCRIPTION = 1000;

function explain(
  outcome: Extract<SuperTeamOutcome, { ok: false }>,
): SuperTeamState {
  switch (outcome.reason) {
    case "name-taken":
      return {
        fieldErrors: { name: "Une super-équipe porte déjà ce nom." },
      };
    case "bad-name":
      return {
        fieldErrors: {
          name: "Ce nom ne contient pas assez de lettres ou de chiffres.",
        },
      };
    case "already-attached":
      return {
        message:
          "Cette équipe appartient déjà à une autre super-équipe. Détachez-la d’abord.",
      };
    case "not-a-member":
      return {
        message:
          "Cette personne n’est dans aucune équipe de cette super-équipe. Le capitaine se choisit parmi ses membres.",
      };
    case "not-found":
      return { message: "Cette super-équipe n’existe plus." };
    default:
      return {
        message: "L’opération n’a pas abouti. Réessayez dans un instant.",
      };
  }
}

function checkName(name: string): string | null {
  if (name.length < 2 || name.length > 80) {
    return "Le nom doit faire entre 2 et 80 caractères.";
  }

  return null;
}

export async function createSuperTeamAction(
  _previous: SuperTeamState,
  formData: FormData,
): Promise<SuperTeamState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const nameError = checkName(name);
  if (nameError) return { fieldErrors: { name: nameError } };

  if (description.length > MAX_DESCRIPTION) {
    return {
      fieldErrors: {
        description: `La description ne peut pas dépasser ${MAX_DESCRIPTION} caractères.`,
      },
    };
  }

  const outcome = await createSuperTeam(name, description);

  if (!outcome.ok) {
    return explain({ ok: false, reason: outcome.reason });
  }

  await logAdminAction({
    action: "super_team.created",
    targetTable: "super_teams",
    targetId: outcome.superTeamId,
    payload: { name },
  });

  revalidatePath("/admin/super-equipes");
  return { done: true };
}

export async function renameSuperTeamAction(
  _previous: SuperTeamState,
  formData: FormData,
): Promise<SuperTeamState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const superTeamId = String(formData.get("superTeamId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!superTeamId) return { message: "Super-équipe introuvable." };

  const nameError = checkName(name);
  if (nameError) return { fieldErrors: { name: nameError } };

  const outcome = await renameSuperTeam(superTeamId, name);
  if (!outcome.ok) return explain(outcome);

  await logAdminAction({
    action: "super_team.renamed",
    targetTable: "super_teams",
    targetId: superTeamId,
    payload: { name },
  });

  revalidatePath("/admin/super-equipes");
  return { done: true, message: "Nom mis à jour." };
}

export async function attachTeamAction(
  _previous: SuperTeamState,
  formData: FormData,
): Promise<SuperTeamState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const superTeamId = String(formData.get("superTeamId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();

  if (!superTeamId || !teamId) {
    return { message: "Choisissez une équipe à rattacher." };
  }

  const outcome = await attachTeam(superTeamId, teamId);
  if (!outcome.ok) return explain(outcome);

  await logAdminAction({
    action: "super_team.team_attached",
    targetTable: "teams",
    targetId: teamId,
    payload: { super_team_id: superTeamId },
  });

  revalidatePath("/admin/super-equipes");
  return { done: true, message: "Équipe rattachée." };
}

export async function detachTeamAction(
  _previous: SuperTeamState,
  formData: FormData,
): Promise<SuperTeamState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!teamId) return { message: "Équipe introuvable." };

  const outcome = await detachTeam(teamId);
  if (!outcome.ok) return explain(outcome);

  await logAdminAction({
    action: "super_team.team_detached",
    targetTable: "teams",
    targetId: teamId,
  });

  revalidatePath("/admin/super-equipes");
  return {
    done: true,
    message:
      "Équipe détachée. Elle garde ses membres, ses points et son rang au classement général.",
  };
}

export async function assignSuperCaptainAction(
  _previous: SuperTeamState,
  formData: FormData,
): Promise<SuperTeamState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const superTeamId = String(formData.get("superTeamId") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!superTeamId || !profileId) {
    return { message: "Choisissez un capitaine." };
  }

  const outcome = await assignSuperCaptain(superTeamId, profileId);
  if (!outcome.ok) return explain(outcome);

  await logAdminAction({
    action: "super_team.captain_assigned",
    targetTable: "super_teams",
    targetId: superTeamId,
    payload: { profile_id: profileId },
  });

  revalidatePath("/admin/super-equipes");
  return { done: true, message: "Capitaine désigné." };
}

export async function deleteSuperTeamAction(
  _previous: SuperTeamState,
  formData: FormData,
): Promise<SuperTeamState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const superTeamId = String(formData.get("superTeamId") ?? "").trim();
  if (!superTeamId) return { message: "Super-équipe introuvable." };

  const outcome = await deleteSuperTeam(superTeamId);
  if (!outcome.ok) return explain(outcome);

  await logAdminAction({
    action: "super_team.deleted",
    targetTable: "super_teams",
    targetId: superTeamId,
  });

  revalidatePath("/admin/super-equipes");
  return {
    done: true,
    message: "Super-équipe supprimée. Ses équipes existent toujours.",
  };
}
