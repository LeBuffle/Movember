"use server";

import { revalidatePath } from "next/cache";

import { isTeamKind, createTeam, joinTeam } from "@/lib/teams/membership";

/**
 * The two gestures a participant makes about teams.
 *
 * Every refusal is a sentence somebody can act on. An unknown join code is
 * the common case, not an incident: the likeliest explanation is a character
 * misread off a whiteboard, and the answer has to invite a second attempt
 * rather than announce a failure.
 */

export type TeamFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  joined?: string;
};

export async function createTeamAction(
  _previous: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "libre");

  if (name.length < 2 || name.length > 60) {
    return {
      fieldErrors: { name: "Le nom doit faire entre 2 et 60 caractères." },
    };
  }

  if (!isTeamKind(kind)) {
    return { fieldErrors: { kind: "Choisissez un type d’équipe." } };
  }

  const outcome = await createTeam(name, kind);

  if (!outcome.ok) {
    switch (outcome.reason) {
      case "unauthenticated":
        return { message: "Reconnectez-vous pour créer une équipe." };
      case "already-in-team":
        return {
          message:
            "Vous faites déjà partie d’une équipe. Quittez-la d’abord si vous voulez en créer une autre.",
        };
      case "name-taken":
        return {
          fieldErrors: {
            name: "Ce nom est déjà pris. Trouvez-en un autre — deux équipes du même nom rendraient le classement illisible.",
          },
        };
      case "bad-name":
        return {
          fieldErrors: {
            name: "Ce nom ne contient pas assez de lettres ou de chiffres.",
          },
        };
      default:
        return {
          message:
            "L’équipe n’a pas pu être créée. Réessayez dans un instant — rien n’a été perdu.",
        };
    }
  }

  revalidatePath("/jeu/equipe");
  return { joined: outcome.teamId };
}

export async function joinTeamAction(
  _previous: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const code = String(formData.get("code") ?? "");

  const outcome = await joinTeam(code);

  if (!outcome.ok) {
    switch (outcome.reason) {
      case "unauthenticated":
        return { message: "Reconnectez-vous pour rejoindre une équipe." };
      case "unknown-code":
        return {
          fieldErrors: {
            code: "Ce code ne correspond à aucune équipe. Vérifiez-le auprès de la personne qui vous l’a donné — les codes ne contiennent jamais de O, de I, de L, de 0 ni de 1.",
          },
        };
      case "already-in-team":
        return {
          message:
            "Vous faites déjà partie d’une autre équipe. Quittez-la d’abord pour rejoindre celle-ci.",
        };
      default:
        return {
          message:
            "L’adhésion n’a pas pu être enregistrée. Réessayez dans un instant.",
        };
    }
  }

  revalidatePath("/jeu/equipe");
  return { joined: outcome.teamId };
}
