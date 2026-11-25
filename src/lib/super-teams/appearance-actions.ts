"use server";

import { revalidatePath } from "next/cache";

import {
  clearOwnTeamLogo,
  setOwnTeamLogo,
  setSuperTeamAppearance,
  type AppearanceOutcome,
} from "@/lib/super-teams/appearance";

/**
 * What a captain may change about their own team or federation.
 *
 * **No identifier is read from the form here, and that is the guard.** The
 * team and the super team are found from the session; a posted identifier is
 * whatever the sender chose to write, and "captain of the team you claim" is
 * not a rule. It is also why the appearance screen cannot be reached by
 * typing somebody else's address — there is no address to type.
 */

export type AppearanceState = {
  message?: string;
  done?: boolean;
  error?: string;
};

function explain(
  outcome: Extract<AppearanceOutcome, { ok: false }>,
): AppearanceState {
  switch (outcome.reason) {
    case "unauthenticated":
      return { error: "Reconnectez-vous pour continuer." };
    case "not-captain":
      return { error: "Seul le capitaine peut faire cela." };
    case "bad-file":
      return { error: outcome.message };
    default:
      return {
        error: "L’opération n’a pas abouti. Réessayez dans un instant.",
      };
  }
}

export async function setTeamLogoAction(
  _previous: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisissez une image." };
  }

  const outcome = await setOwnTeamLogo(file);
  if (!outcome.ok) return explain(outcome);

  revalidatePath("/jeu/equipe");
  revalidatePath("/jeu/classement");

  return { done: true, message: "Logo mis à jour." };
}

export async function clearTeamLogoAction(
  _previous: AppearanceState,
  _formData: FormData,
): Promise<AppearanceState> {
  const outcome = await clearOwnTeamLogo();
  if (!outcome.ok) return explain(outcome);

  revalidatePath("/jeu/equipe");
  revalidatePath("/jeu/classement");

  return { done: true, message: "Logo retiré." };
}

export async function setSuperTeamAppearanceAction(
  _previous: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  const file = formData.get("logo");
  const description = String(formData.get("description") ?? "");
  const removeLogo = formData.get("removeLogo") === "on";

  const outcome = await setSuperTeamAppearance({
    description,
    file: file instanceof File ? file : null,
    removeLogo,
  });

  if (!outcome.ok) return explain(outcome);

  revalidatePath("/jeu/super-equipe");

  return { done: true, message: "Apparence mise à jour." };
}
