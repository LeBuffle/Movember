"use server";

import { readJournal, type Journal } from "@/lib/activities/journal";
import { isCategory } from "@/lib/leaderboards/categories";

/**
 * Le journal, chargé quand quelqu'un ouvre un dépliant (story 15.4).
 *
 * **Une action plutôt qu'un rendu au chargement de la page.** Un classement
 * de cinquante lignes qui préchargerait cinquante journaux ferait cinquante
 * lectures pour une seule qui sera lue — sur un téléphone en données mobiles,
 * en novembre, c'est la différence entre un écran qui s'ouvre et un écran
 * qu'on ferme.
 *
 * L'identifiant vient du formulaire, et c'est sans danger ici : `readJournal`
 * n'accorde rien qu'un participant ne puisse déjà obtenir en cliquant sur la
 * ligne d'à côté, et il applique lui-même les trois exclusions.
 */

export type JournalState = { journal?: Journal };

export async function readJournalAction(
  _previous: JournalState,
  formData: FormData,
): Promise<JournalState> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  const category = String(formData.get("categorie") ?? "");

  if (!profileId || !isCategory(category)) {
    return { journal: { state: "unavailable" } };
  }

  return { journal: await readJournal(profileId, category) };
}
