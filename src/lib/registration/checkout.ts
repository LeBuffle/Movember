import "server-only";

import type Stripe from "stripe";

import type { RegistrationTier } from "@/lib/registration/tiers";
import { absoluteUrl } from "@/lib/site-url";
import { stripeClient } from "@/lib/stripe/client";

/**
 * Creating the payment session.
 *
 * This is the moment the price is fixed, and everything here follows from one
 * rule: **nothing that decides an amount may come from the browser** (PRD D1).
 * The page sends a tier slug; the amount is read from the database and passed
 * to Stripe from the server. A price sent by the client is a price chosen by
 * the client, and it is the classic failure of online payment.
 *
 * The session decides nothing else. It does not activate anyone — only the
 * webhook does (architecture D5, story 2.4). What this creates is an
 * *intention to pay*, and an abandoned intention leaves a `pending`
 * registration that can be picked up again (AC 5).
 */

export type CheckoutOutcome =
  { ok: true; url: string } | { ok: false; reason: string };

/**
 * Where Stripe sends the participant back.
 *
 * Built from the configured site address, **never from the request**
 * (AC 6). Two reasons, both learned the hard way in story 1.4: Next's
 * standalone server reports the address it is bound to — `0.0.0.0:3000`
 * inside the container — and `X-Forwarded-Host` is a header anyone can send,
 * which would turn our payment return into an open redirect.
 */
export function checkoutReturnUrls(tierSlug: string): {
  successUrl: string;
  cancelUrl: string;
} {
  const base = `/participer/${encodeURIComponent(tierSlug)}/paiement`;

  return {
    // `{CHECKOUT_SESSION_ID}` is a placeholder Stripe substitutes. It must
    // reach the URL unencoded, which is why it is appended rather than built
    // through URLSearchParams.
    successUrl: absoluteUrl(
      `${base}?statut=succes&session={CHECKOUT_SESSION_ID}`,
    ),
    cancelUrl: absoluteUrl(`${base}?statut=abandon`),
  };
}

export type CheckoutRequest = {
  registrationId: string;
  profileId: string;
  editionId: string;
  tier: RegistrationTier;
  /** Prefills Stripe's form. Read from the session, never from the form. */
  email?: string;
};

export async function createCheckoutSession(
  request: CheckoutRequest,
  // Injected so the shape of what we send Stripe can be asserted in a test
  // without a network call. Production passes nothing.
  client: Stripe | null = stripeClient(),
): Promise<CheckoutOutcome> {
  if (!client) return { ok: false, reason: "stripe-unavailable" };

  const { tier } = request;

  // A price of zero would produce a session Stripe accepts and nobody pays.
  // Refusing is the only safe reading: something is wrong upstream.
  if (!Number.isInteger(tier.priceCents) || tier.priceCents <= 0) {
    console.error("[paiement] montant invalide en base", {
      tier: tier.slug,
      priceCents: tier.priceCents,
    });
    return { ok: false, reason: "invalid-amount" };
  }

  const { successUrl, cancelUrl } = checkoutReturnUrls(tier.slug);

  /* Carried on the session *and* on the payment intent. The webhook reads it
     from the session (story 2.4); the accounting line and the refund start
     from the payment side (stories 2.6 and 2.8) and would otherwise have to
     walk back to the session to know who paid. */
  const references = {
    registration_id: request.registrationId,
    profile_id: request.profileId,
    edition_id: request.editionId,
    tier_id: tier.id,
    tier_slug: tier.slug,
  };

  try {
    const session = await client.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      submit_type: "pay",
      customer_email: request.email,
      client_reference_id: request.registrationId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            // From the database. This is the line the whole story is about.
            unit_amount: tier.priceCents,
            product_data: {
              name: `Inscription ${tier.name}`,
              description: tier.tagline,
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
      console.error("[paiement] session créée sans adresse", {
        session: session.id,
      });
      return { ok: false, reason: "no-url" };
    }

    return { ok: true, url: session.url };
  } catch (error) {
    // The message is logged, never shown: Stripe's errors are in English and
    // occasionally mention internal detail. The participant gets a sentence
    // that tells them what to do instead.
    console.error("[paiement] création de session impossible", {
      message: error instanceof Error ? error.message : "inconnue",
    });
    return { ok: false, reason: "stripe-error" };
  }
}
