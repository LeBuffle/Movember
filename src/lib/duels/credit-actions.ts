"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/auth/routes";
import { getLotBySlug } from "@/lib/duels/catalogue";
import { createLotCheckoutSession } from "@/lib/duels/checkout";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CreditFormState = { message?: string };

const WALLET = "/jeu/defis-joueurs/credits";

/**
 * Buying a lot of credits (story 12.2).
 *
 * The same three rules as every other payment, and they matter here because
 * this writes with the service key, which bypasses row level security.
 *
 * 1. **The identity comes from the session**, never from the form.
 * 2. **The amount comes from the database**, never from the form. The browser
 *    sends a slug; the price is looked up.
 * 3. **The row is created `pending`.** It credits nothing. Only the webhook
 *    settles it (architecture D5), so the worst a crafted request can produce
 *    is a purchase that has paid nothing and holds nothing.
 *
 * And one of its own: **only an active participant may buy.** Credits are
 * spent on other participants; selling them to somebody who has not finished
 * registering would create a payment with no registration to refund against.
 */
export async function buyCredits(
  _previous: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  const slug = String(formData.get("lot") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`${ROUTES.signIn}?suite=${WALLET}`);

  const lot = await getLotBySlug(slug);

  if (!lot) {
    // Includes the case where the database could not be read. Refusing is the
    // only safe answer: the next step charges money.
    return {
      message: "Ce lot n’est pas disponible. Réessayez dans quelques instants.",
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
        "Les défis entre joueurs sont réservés aux participants inscrits. Finalisez d’abord votre inscription.",
    };
  }

  /* The purchase exists before anyone is sent to Stripe, and that ordering is
     the point: a payment that goes astray still has a thread to pull on.
     Without it, somebody who pays and never comes back leaves nothing to
     answer "j'ai payé et je n'ai rien reçu" with. */
  const { data: purchase, error } = await admin
    .from("duel_lot_purchases")
    .insert({
      profile_id: user.id,
      edition_id: edition.id,
      lot_id: lot.id,
      status: "pending",
      // The promise, frozen here: what was sold is what is delivered, even if
      // the lot is repriced tomorrow (architecture D12).
      price_cents: lot.priceCents,
      credits: lot.credits,
    })
    .select("id")
    .maybeSingle();

  if (error || !purchase) {
    console.error("[défis-joueurs] achat non enregistré", {
      code: error?.code,
    });
    return {
      message:
        "Votre achat n’a pas pu être enregistré. Réessayez dans un instant.",
    };
  }

  const outcome = await createLotCheckoutSession({
    purchaseId: purchase.id,
    profileId: user.id,
    editionId: edition.id,
    lot,
    email: user.email,
  });

  if (!outcome.ok) {
    // The purchase stays `pending` and credits nothing. Saying so plainly
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
