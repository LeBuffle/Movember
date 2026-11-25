"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Marking a card as seen.
 *
 * **Written with the service key, and that needs saying.** `card_grants`
 * carries no write policy for anybody — the rule that keeps somebody from
 * granting themselves the legendary. Opening a card is a write on that same
 * row, so it cannot go through the participant's session, and an update
 * policy would not help: row level security filters ROWS, not COLUMNS. A
 * participant allowed to write `revealed_at` would be allowed to write
 * `source` in the same statement, and turn a card bought in a pack into a
 * card earned by playing (architecture D8).
 *
 * The identity is therefore checked here, and the check is carried by the
 * write itself: `profile_id` must match the session, so a grant identifier
 * belonging to somebody else changes nothing.
 */

export type RevealState = { message?: string };

export async function markRevealed(
  _previous: RevealState,
  formData: FormData,
): Promise<RevealState> {
  const grantId = String(formData.get("grantId") ?? "").trim();
  if (!grantId) return { message: "Carte introuvable." };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { message: "Reconnectez-vous pour continuer." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("card_grants")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("profile_id", user.id)
    .is("revealed_at", null);

  if (error) {
    console.error("[cartes] révélation non enregistrée", { code: error.code });

    // Not a refusal the participant should be stopped by: they have seen the
    // card, and the worst case is being shown it once more. Saying so and
    // moving on beats a dead end on the one screen that is supposed to be a
    // pleasant moment.
    return {
      message:
        "La carte est bien à vous. Elle vous sera peut-être proposée une fois de plus — ce n’est pas grave.",
    };
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/collection");
  redirect("/jeu/collection/reveler");
}
