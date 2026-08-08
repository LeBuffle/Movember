"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { getPackBySlug } from "@/lib/packs/catalogue";
import { createPackCheckoutSession } from "@/lib/packs/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PackFormState = { message?: string };

const SHOP = "/jeu/boutique";

/**
 * Buying a pack (story 10.3).
 *
 * The same three rules as the registration payment, and they matter here for
 * the same reason — this writes with the service key, which bypasses row
 * level security entirely.
 *
 * 1. **The identity comes from the session**, never from the form.
 * 2. **The amount comes from the database**, never from the form. The browser
 *    sends a slug; the price is looked up.
 * 3. **The row is created `pending`.** It grants nothing. Only the webhook
 *    settles it and draws the cards (architecture D5), so the worst a crafted
 *    request can produce is a purchase that has paid nothing and holds
 *    nothing.
 *
 * One extra rule of its own: **only an active participant may buy.** The shop
 * is inside the game. Selling cards to somebody who has not registered would
 * make the album reachable without playing, and would create a payment with
 * no registration to refund it against.
 */
export async function buyPack(
  _previous: PackFormState,
  formData: FormData,
): Promise<PackFormState> {
  const slug = String(formData.get("pack") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`${ROUTES.signIn}?suite=${SHOP}`);

  const pack = await getPackBySlug(slug);

  if (!pack) {
    // Includes the case where the database could not be read. Refusing is
    // the only safe answer: the next step charges money.
    return {
      message:
        "Ce pack n’est pas disponible. Réessayez dans quelques instants.",
    };
  }

  const admin = createAdminClient();

  const { data: edition } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return { message: "L’édition n’est pas ouverte. Réessayez plus tard." };
  }

  const { data: registration } = await admin
    .from("registrations")
    .select("status")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  if (registration?.status !== "active") {
    return {
      message:
        "Les packs sont réservés aux participants inscrits. Finalisez d’abord votre inscription.",
    };
  }

  /* The purchase exists before anyone is sent to Stripe, and that ordering is
     the point: a payment that goes astray still has a thread to pull on.
     Without it, somebody who pays and never comes back leaves nothing to
     answer "j'ai payé et je n'ai rien reçu" with.

     A new row each time rather than a reused one: unlike a registration,
     buying a second pack is a normal thing to do, and the two purchases must
     stay separate. */
  const { data: purchase, error } = await admin
    .from("pack_purchases")
    .insert({
      profile_id: user.id,
      edition_id: edition.id,
      pack_id: pack.id,
      status: "pending",
      // The promise, frozen here: what was sold is what is delivered, even if
      // the pack is reshaped tomorrow (architecture D12).
      price_cents: pack.priceCents,
      card_count: pack.cardCount,
      guaranteed_rarity: pack.guaranteedRarity,
    })
    .select("id")
    .maybeSingle();

  if (error || !purchase) {
    console.error("[packs] achat non enregistré", { code: error?.code });
    return {
      message:
        "Votre achat n’a pas pu être enregistré. Réessayez dans un instant.",
    };
  }

  const outcome = await createPackCheckoutSession({
    purchaseId: purchase.id,
    profileId: user.id,
    editionId: edition.id,
    pack,
    email: user.email,
  });

  if (!outcome.ok) {
    // The purchase stays `pending` and grants nothing. Saying so plainly
    // rather than sending them back to a shop that looks unchanged.
    return {
      message:
        outcome.reason === "stripe-unavailable"
          ? "Le paiement n’est pas encore ouvert. Réessayez plus tard."
          : "Le paiement n’a pas pu être lancé. Réessayez dans un instant.",
    };
  }

  redirect(outcome.url);
}
