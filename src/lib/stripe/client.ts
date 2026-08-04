import "server-only";

import Stripe from "stripe";

import { APP_ENVIRONMENT } from "@/lib/app-version";

/**
 * The Stripe client — server side, and only there.
 *
 * `server-only` at the top of the file is the guard that matters (NFR13): if
 * a client component ever imports this module, the build fails rather than
 * shipping the secret key to a browser. A comment saying "do not import from
 * the client" would not have stopped anyone.
 *
 * Note what is *not* needed: the publishable key. Stripe Checkout is hosted
 * on Stripe's own pages, so the browser is handed a URL and nothing else —
 * no Stripe code runs in our page, and no card number ever reaches us
 * (AC 1). That is the whole point of choosing hosted Checkout over an
 * embedded form.
 */

/**
 * Pinned rather than left to float.
 *
 * Stripe changes its API on dated versions; letting the library pick the
 * latest one means a routine dependency bump can change what a webhook
 * receives, in November, on a Sunday. Moving this string is then a deliberate
 * act, with a changelog to read first.
 */
export const STRIPE_API_VERSION = "2026-07-29.dahlia";

let cached: Stripe | null = null;

/** Whether payment can be attempted at all. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** A key that charges real cards. */
export function isLiveKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

/**
 * @returns `null` when Stripe is not usable, never a half-configured client.
 *
 * **A live key outside production is refused.** Preproduction and production
 * are the same application, told apart by their configuration alone, and the
 * day someone copies the wrong key into the staging server is the day a test
 * registration charges a real card. Refusing is loud and recoverable;
 * charging is neither.
 */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    console.error(
      "[stripe] clé secrète absente : le paiement est indisponible",
    );
    return null;
  }

  if (isLiveKey(key) && APP_ENVIRONMENT !== "production") {
    console.error(
      "[stripe] clé de production détectée hors production : paiement refusé",
      { environment: APP_ENVIRONMENT },
    );
    return null;
  }

  cached ??= new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    // Shows up in Stripe's logs next to each request. Worth the two lines the
    // day someone has to work out which deployment created a session.
    appInfo: { name: "DEFI Movember", url: "https://defi-movember.fr" },
    // Two attempts, not more: this call sits between a participant and a
    // payment page, and a request retried for thirty seconds looks broken.
    maxNetworkRetries: 2,
    timeout: 10_000,
  });

  return cached;
}
