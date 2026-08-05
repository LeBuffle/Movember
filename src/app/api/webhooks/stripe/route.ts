import type Stripe from "stripe";

import { recordFeesFromCharge } from "@/lib/accounting/fees";
import { handleCheckoutCompleted } from "@/lib/registration/activation";
import { verifyStripeSignature } from "@/lib/stripe/webhook";

/**
 * Stripe's webhook.
 *
 * The only thing in the application that turns a payment into an active
 * participant (architecture D5). It authenticates by signature rather than by
 * cookie, which is why the middleware skips `api/webhooks` entirely — a
 * session refresh here would be a round trip for nobody.
 *
 * **The reply codes are the whole contract with Stripe.** 200 means "handled,
 * never send it again"; anything else means "please retry", which Stripe does
 * with an increasing delay for up to three days. Answering 200 to a failure
 * to avoid looking broken would lose the payment for good — Stripe would
 * consider the matter closed, and nothing would remain to notice it by.
 *
 * A signature that does not check out gets 400 and no explanation. Telling a
 * caller why their signature was refused is telling them how to get closer.
 */

/** Node, not Edge: signature verification needs Node's crypto. */
export const runtime = "nodejs";

/** Never cached, never prerendered: every call is a distinct event. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // The raw text, untouched. Stripe signs the exact bytes it sent, and
  // parsing then re-serialising the JSON changes them.
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const checked = await verifyStripeSignature(rawBody, signature);

  if (!checked.ok) {
    // 400 rather than 401: there is nothing to authenticate *with* here, and
    // Stripe treats 4xx as "do not retry" — which is right, since a badly
    // signed call will not become well signed on a second attempt.
    return new Response("Signature refusée", { status: 400 });
  }

  const { event } = checked;

  console.info("[webhook] reçu", { id: event.id, type: event.type });

  switch (event.type) {
    case "checkout.session.completed":
    // A delayed payment method confirming later. Cards do not use this path,
    // but the handler is the same and the alternative is a lost payment the
    // day a bank transfer is ever accepted.
    case "checkout.session.async_payment_succeeded": {
      const result = await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );

      if (!result.ok) {
        console.error("[webhook] traitement en échec, Stripe réessaiera", {
          id: event.id,
          reason: result.reason,
        });
        return new Response("Traitement en échec", { status: 500 });
      }

      return Response.json({ received: true, outcome: result.outcome });
    }

    // The fee, which the payment events above do not carry (story 2.6). It
    // lives on the balance transaction, which Stripe produces a moment later.
    case "charge.succeeded":
    // Sent when Stripe restates a charge — including when the balance
    // transaction it was waiting on finally exists.
    case "charge.updated": {
      const result = await recordFeesFromCharge(
        event.data.object as Stripe.Charge,
      );

      if (!result.ok) {
        console.error("[webhook] frais non enregistrés, Stripe réessaiera", {
          id: event.id,
          reason: result.reason,
        });
        return new Response("Traitement en échec", { status: 500 });
      }

      return Response.json({ received: true, outcome: result.outcome });
    }

    default:
      // Stripe sends more than what was subscribed to, and will send more
      // still as the account is configured. An unknown type is not an error;
      // pretending otherwise would have Stripe retrying events nobody wants.
      console.info("[webhook] type non traité, ignoré", { type: event.type });
      return Response.json({ received: true, outcome: "unhandled" });
  }
}
