import "server-only";

import type Stripe from "stripe";

import type { CreditLot } from "@/lib/duels/catalogue";
import { absoluteUrl } from "@/lib/site-url";
import { stripeClient } from "@/lib/stripe/client";

/**
 * Paying for a lot of credits (story 12.2).
 *
 * The same rule as every other payment in the project, because it is the same
 * rule: **nothing that decides an amount comes from the browser** (PRD D1).
 * The shop sends a slug; the price is read from the database and handed to
 * Stripe server-side.
 *
 * The session creates an *intention to buy* and nothing else. The credits are
 * granted by the webhook and nowhere else (architecture D5). An abandoned
 * intention leaves a `pending` purchase, which credits nothing.
 */

export type LotCheckoutOutcome =
  { ok: true; url: string } | { ok: false; reason: string };

export function lotReturnUrls(): { successUrl: string; cancelUrl: string } {
  const base = "/jeu/defis-joueurs/credits";

  return {
    // `{CHECKOUT_SESSION_ID}` is a placeholder Stripe substitutes. It has to
    // reach the URL unencoded, hence the concatenation.
    successUrl: absoluteUrl(
      `${base}?statut=succes&session={CHECKOUT_SESSION_ID}`,
    ),
    cancelUrl: absoluteUrl(`${base}?statut=abandon`),
  };
}

export type LotCheckoutRequest = {
  purchaseId: string;
  profileId: string;
  editionId: string;
  lot: CreditLot;
  email?: string;
};

export async function createLotCheckoutSession(
  request: LotCheckoutRequest,
  // Injected so the shape of what we send Stripe can be asserted in a test
  // without a network call. Production passes nothing.
  client: Stripe | null = stripeClient(),
): Promise<LotCheckoutOutcome> {
  if (!client) return { ok: false, reason: "stripe-unavailable" };

  const { lot } = request;

  if (!Number.isInteger(lot.priceCents) || lot.priceCents <= 0) {
    console.error("[défis-joueurs] montant invalide en base", {
      lot: lot.slug,
      priceCents: lot.priceCents,
    });
    return { ok: false, reason: "invalid-amount" };
  }

  const { successUrl, cancelUrl } = lotReturnUrls();

  /* `kind` is what routes this session to the credit handler rather than to
     the registration or the pack one. Read from metadata we wrote ourselves,
     never inferred from the amount — two products can perfectly well cost the
     same, and a 10 € lot and a 10 € registration tier eventually will. */
  const references = {
    kind: "credits",
    purchase_id: request.purchaseId,
    profile_id: request.profileId,
    edition_id: request.editionId,
    lot_id: lot.id,
    lot_slug: lot.slug,
  };

  try {
    const session = await client.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      submit_type: "pay",
      customer_email: request.email,
      client_reference_id: request.purchaseId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            // From the database. This is the line the whole story is about.
            unit_amount: lot.priceCents,
            product_data: {
              name: lot.name,
              description: `${lot.credits} défis à envoyer — ${lot.tagline}`,
            },
          },
        },
      ],
      metadata: references,
      payment_intent_data: { metadata: references },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      console.error("[défis-joueurs] session créée sans adresse", {
        session: session.id,
      });
      return { ok: false, reason: "no-url" };
    }

    return { ok: true, url: session.url };
  } catch (error) {
    // Logged, never shown: Stripe's errors are in English and occasionally
    // mention internal detail.
    console.error("[défis-joueurs] création de session impossible", {
      message: error instanceof Error ? error.message : "inconnue",
    });
    return { ok: false, reason: "stripe-error" };
  }
}
