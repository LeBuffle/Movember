import "server-only";

import type Stripe from "stripe";

import { stripeClient } from "@/lib/stripe/client";

/**
 * Checking that a webhook really comes from Stripe.
 *
 * The route has no session and no cookie — it is called by a machine, from
 * an address we do not control. Its only authentication is this signature,
 * which is why it is the first thing that runs and why nothing is read from
 * the payload before it passes.
 *
 * **The raw body matters.** Stripe signs the exact bytes it sent; parsing the
 * JSON and re-serialising it changes them — key order, whitespace, number
 * formatting — and the signature no longer matches. So the route reads
 * `request.text()` and hands the string over untouched.
 */

export type SignatureCheck =
  | { ok: true; event: Stripe.Event }
  | { ok: false; reason: "not-configured" | "no-signature" | "invalid" };

export async function verifyStripeSignature(
  rawBody: string,
  signature: string | null,
  // Injected for the tests, which sign a payload for real rather than
  // pretending the check happened.
  client: Stripe | null = stripeClient(),
  secret: string | undefined = process.env.STRIPE_WEBHOOK_SECRET,
): Promise<SignatureCheck> {
  if (!client || !secret) {
    console.error("[webhook] secret de signature absent : appel rejeté");
    return { ok: false, reason: "not-configured" };
  }

  if (!signature) return { ok: false, reason: "no-signature" };

  try {
    const event = await client.webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
    );

    return { ok: true, event };
  } catch (error) {
    // Logged, never answered with. Telling a caller *why* their signature was
    // refused is telling them how to get closer.
    console.error("[webhook] signature invalide", {
      message: error instanceof Error ? error.message : "inconnue",
    });
    return { ok: false, reason: "invalid" };
  }
}
