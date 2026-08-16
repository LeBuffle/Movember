"use server";

import { revalidatePath } from "next/cache";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { shippingAddressSchema } from "@/lib/shipping/address";
import { createClient } from "@/lib/supabase/server";

/**
 * Recording and correcting a delivery address.
 *
 * Written through the participant's own session — **not** the service key.
 * Row level security is what guarantees someone can only write their own,
 * and it keeps that guarantee even if this file were later called from
 * somewhere careless.
 *
 * Correctable until the end of the game (AC 3). Parcels go out in December;
 * a move in November has to be able to follow.
 */

export type AddressFormState = {
  errors?: Record<string, string>;
  message?: string;
  saved?: boolean;
};

export async function saveShippingAddress(
  _previous: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Votre session a expiré. Reconnectez-vous." };
  }

  const parsed = shippingAddressSchema.safeParse({
    recipient_name: formData.get("recipient_name") ?? "",
    line1: formData.get("line1") ?? "",
    line2: formData.get("line2") ?? "",
    postal_code: formData.get("postal_code") ?? "",
    city: formData.get("city") ?? "",
    country: String(formData.get("country") ?? "FR") || "FR",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      errors[key] ??= issue.message;
    }

    return { errors };
  }

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return { message: "L’édition n’a pas été trouvée. Réessayez plus tard." };
  }

  /* One address per person per edition, enforced by a unique constraint.
     `upsert` on that constraint is what makes "save" and "correct" the same
     action — and what makes a double submit harmless. */
  const { error } = await supabase.from("shipping_addresses").upsert(
    {
      profile_id: user.id,
      edition_id: edition.id,
      ...parsed.data,
      line2: parsed.data.line2 || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,edition_id" },
  );

  if (error) {
    console.error("[livraison] adresse non enregistrée", { code: error.code });
    return {
      message:
        "Votre adresse n’a pas pu être enregistrée. Réessayez dans un instant.",
    };
  }

  revalidatePath("/mon-compte/adresse");
  revalidatePath("/mon-compte");

  return { saved: true };
}

/**
 * Erasing one's own address, without giving up the game.
 *
 * The right to have this removed does not depend on leaving. Deleting the
 * account erases it too (the row cascades), but that should not be the only
 * way out.
 */
export async function deleteShippingAddress(
  _previous: AddressFormState,
  _formData: FormData,
): Promise<AddressFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Votre session a expiré. Reconnectez-vous." };
  }

  // Scoped to the caller in the application *and* by row level security. The
  // policy is what actually enforces it; this is what makes the query say so.
  const { error } = await supabase
    .from("shipping_addresses")
    .delete()
    .eq("profile_id", user.id);

  if (error) {
    console.error("[livraison] suppression impossible", { code: error.code });
    return { message: "L’adresse n’a pas pu être supprimée." };
  }

  revalidatePath("/mon-compte/adresse");
  revalidatePath("/mon-compte");

  return {};
}
