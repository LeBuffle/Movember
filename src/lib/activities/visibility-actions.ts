"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * « Ne pas montrer mes sorties aux autres participants » (story 15.2).
 *
 * **Écrit par la session, jamais par un identifiant de formulaire.** Le
 * réglage de quelqu'un d'autre ne se pose pas ici : il n'y a pas de champ à
 * modifier pour l'atteindre.
 *
 * Passé par la session du participant plutôt que par la clé de service : la
 * sécurité au niveau des lignes sait parfaitement dire « cette ligne est la
 * vôtre », et c'est exactement la règle voulue. Même arrangement que le
 * réglage des défis de l'epic 12.
 */

export type VisibilityState = { message?: string; success?: string };

export async function setActivitiesVisibility(
  _previous: VisibilityState,
  formData: FormData,
): Promise<VisibilityState> {
  // La case cochée veut dire « montrer ». Absente, elle veut dire « couper ».
  const optOut = formData.get("montrer") === null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.signIn);

  const { error } = await supabase
    .from("profiles")
    .update({ activities_opt_out: optOut })
    .eq("id", user.id);

  if (error) {
    console.error("[sorties] réglage non enregistré", { code: error.code });

    return { message: "Le réglage n’a pas pu être enregistré. Réessayez." };
  }

  revalidatePath("/mon-compte");
  revalidatePath("/jeu/classement");

  return {
    success: optOut
      ? "Vos sorties ne sont plus visibles par les autres participants."
      : "Vos sorties sont visibles par les autres participants.",
  };
}
