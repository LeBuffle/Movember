import "server-only";

import type Stripe from "stripe";

import type { CardPack } from "@/lib/packs/catalogue";
import { absoluteUrl } from "@/lib/site-url";
import { stripeClient } from "@/lib/stripe/client";

/**
 * Paying for a pack (story 10.3).
 *
 * The same rule as the registration payment, because it is the same rule:
 * **nothing that decides an amount comes from the browser** (PRD D1). The
 * shop sends a slug; the price is read from the database and handed to Stripe
 * server-side.
 *
 * The session decides nothing else. It creates an *intention to buy*; the
 * cards are drawn by the webhook and nowhere else (architecture D5). An
 * abandoned intention leaves a `pending` purchase, which grants nothing.
 */

export type PackCheckoutOutcome =
  { ok: true; url: string } | { ok: false; reason: string };

/** Where Stripe sends the buyer back. Built from the configured site address. */
export function packReturnUrls(): { successUrl: string; cancelUrl: string } {
  const base = "/jeu/boutique";

  return {
    // `{CHECKOUT_SESSION_ID}` is a placeholder Stripe substitutes. It has to
    // reach the URL unencoded, hence the concatenation.
    successUrl: absoluteUrl(
      `${base}?statut=succes&session={CHECKOUT_SESSION_ID}`,
    ),
    cancelUrl: absoluteUrl(`${base}?statut=abandon`),
  };
}

export type PackCheckoutRequest = {
  purchaseId: string;
  profileId: string;
  editionId: string;
  pack: CardPack;
  email?: string;
};

export async function createPackCheckoutSession(
  request: PackCheckoutRequest,
  // Injected so the shape of what we send Stripe can be asserted in a test
  // without a network call. Production passes nothing.
  client: Stripe | null = stripeClient(),
): Promise<PackCheckoutOutcome> {
  if (!client) return { ok: false, reason: "stripe-unavailable" };

  const { pack } = request;

  if (!Number.isInteger(pack.priceCents) || pack.priceCents <= 0) {
    console.error("[packs] montant invalide en base", {
      pack: pack.slug,
      priceCents: pack.priceCents,
    });
    return { ok: false, reason: "invalid-amount" };
  }

  const { successUrl, cancelUrl } = packReturnUrls();

  /* `kind` is what routes this session to the pack handler rather than to the
     registration one. It is read from the metadata we wrote ourselves, never
     inferred from the amount — two products can perfectly well cost the same. */
  const references = {
    kind: "pack",
    purchase_id: request.purchaseId,
    profile_id: request.profileId,
    edition_id: request.editionId,
    pack_id: pack.id,
    pack_slug: pack.slug,
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
            unit_amount: pack.priceCents,
            product_data: {
              name: pack.name,
              description: `${pack.cardCount} cartes — ${pack.tagline}`,
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
      console.error("[packs] session créée sans adresse", {
        session: session.id,
      });
      return { ok: false, reason: "no-url" };
    }

    return { ok: true, url: session.url };
  } catch (error) {
    // Logged, never shown: Stripe's errors are in English and occasionally
    // mention internal detail.
    console.error("[packs] création de session impossible", {
      message: error instanceof Error ? error.message : "inconnue",
    });
    return { ok: false, reason: "stripe-error" };
  }
}
