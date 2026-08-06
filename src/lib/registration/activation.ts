import "server-only";

import type Stripe from "stripe";

import { grantBonusPacks } from "@/lib/cards/grant";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Turning a confirmed payment into an active participant.
 *
 * **Only this file activates anyone** (architecture D5). The redirect the
 * participant follows on the way back from Stripe is not proof of anything:
 * it is triggered by a browser, so it can be forged, and it does not happen
 * at all when someone closes the tab — which is most of the time, on a phone.
 * Activating on the return would open the game to whoever guesses the success
 * URL and close it to whoever actually paid.
 *
 * Writes with the service key, and this is the one place in the epic where
 * that is right: a webhook has no session because it acts on nobody's behalf.
 */

export type ActivationResult =
  | { ok: true; outcome: "activated" | "already-processed" | "ignored" }
  | { ok: false; reason: string };

/** Postgres' unique-violation code — what a replayed webhook runs into. */
const UNIQUE_VIOLATION = "23505";

/**
 * How the amount paid divides between the donation and the counterpart.
 *
 * The gross is what Stripe says was actually charged, never what the price
 * list says it should have been: the accounts follow the money. The donation
 * is the association's commitment for that tier, capped by the gross so the
 * two can never add up to more than what came in.
 *
 * Both are copied onto the payment row rather than referenced, so that
 * changing a tier's split in October does not rewrite September's accounts
 * (architecture D12).
 */
export function splitAmounts(
  grossCents: number,
  donatedCents: number,
): { donation_cents: number; counterpart_cents: number } {
  const donation = Math.max(0, Math.min(donatedCents, grossCents));

  return { donation_cents: donation, counterpart_cents: grossCents - donation };
}

/** The references we put on the session in story 2.3, read back. */
export function readReferences(session: Stripe.Checkout.Session): {
  registrationId: string | null;
  profileId: string | null;
  editionId: string | null;
  tierId: string | null;
} {
  const metadata = session.metadata ?? {};

  return {
    // `client_reference_id` and the metadata carry the same value. Reading
    // both means a session created before the metadata was added — or by
    // hand, from the Stripe dashboard — still finds its registration.
    registrationId:
      session.client_reference_id ?? metadata.registration_id ?? null,
    profileId: metadata.profile_id ?? null,
    editionId: metadata.edition_id ?? null,
    tierId: metadata.tier_id ?? null,
  };
}

/**
 * @returns `ok: false` when Stripe should try again.
 *
 * Answering 200 to a failure would be the worst possible outcome: Stripe
 * considers the matter closed and never retries, so the payment is taken and
 * the participant never activated — with nothing left to notice it by.
 */
/**
 * The two packs that come with tier 3, if this is one.
 *
 * Never fails the activation. Somebody who paid must be let into the game
 * even if their cards could not be drawn — the catalogue may simply be empty
 * in September. The line logged here is what a human acts on.
 */
async function grantPacksForTier(registrationId: string): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("registrations")
    .select("profile_id, edition_id, registration_tiers (slug)")
    .eq("id", registrationId)
    .maybeSingle();

  const row = data as unknown as {
    profile_id: string;
    edition_id: string;
    registration_tiers: { slug: string } | null;
  } | null;

  if (!row || row.registration_tiers?.slug !== "legendaire") return;

  const outcome = await grantBonusPacks(row.profile_id, row.edition_id);

  if (outcome.granted > 0) {
    console.info("[cartes] packs bonus attribués", {
      registration: registrationId,
      cards: outcome.granted,
    });
  }
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<ActivationResult> {
  // A session can complete without being paid — delayed payment methods do
  // exactly that. Only `paid` opens anything.
  if (session.payment_status !== "paid") {
    console.info("[webhook] session non payée, ignorée", {
      session: session.id,
      status: session.payment_status,
    });
    return { ok: true, outcome: "ignored" };
  }

  const { registrationId, profileId, editionId, tierId } =
    readReferences(session);

  if (!registrationId || !profileId || !editionId) {
    // Unrecoverable: retrying will not add references that were never there.
    // Reported as handled so Stripe stops, and logged loudly so a human sees
    // it — a payment exists with nothing to attach it to.
    console.error("[webhook] session sans références exploitables", {
      session: session.id,
    });
    return { ok: true, outcome: "ignored" };
  }

  const grossCents = session.amount_total ?? 0;

  if (grossCents <= 0) {
    console.error("[webhook] montant absent sur la session", {
      session: session.id,
    });
    return { ok: false, reason: "no-amount" };
  }

  const admin = createAdminClient();

  // The split comes from the tier as it stands, not from the session: the
  // amount is Stripe's business, how it is allocated is ours.
  let donatedCents = 0;

  if (tierId) {
    const { data: tier } = await admin
      .from("registration_tiers")
      .select("donated_cents, price_cents")
      .eq("id", tierId)
      .maybeSingle();

    donatedCents = tier?.donated_cents ?? 0;

    if (tier && tier.price_cents !== grossCents) {
      // Not a refusal — the money is in, and the accounts must say so. But
      // it means the price moved between the session and the payment, and
      // that is worth a human's attention at reconciliation time.
      console.warn("[webhook] montant payé différent du tarif courant", {
        session: session.id,
        paid: grossCents,
        listed: tier.price_cents,
      });
    }
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { error: paymentError } = await admin.from("payments").insert({
    registration_id: registrationId,
    profile_id: profileId,
    edition_id: editionId,
    kind: "registration",
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    gross_cents: grossCents,
    // Left null on purpose: Stripe does not know the fee yet at this point.
    // Story 2.6 fills it in from the real balance transaction, never
    // estimated. Null means "not known"; zero would be a lie.
    fee_cents: null,
    net_cents: null,
    ...splitAmounts(grossCents, donatedCents),
  });

  const duplicate = paymentError?.code === UNIQUE_VIOLATION;

  if (paymentError && !duplicate) {
    console.error("[webhook] ligne comptable non créée", {
      session: session.id,
      code: paymentError.code,
    });
    return { ok: false, reason: "payment-insert-failed" };
  }

  /* Activation runs even when the payment line was already there.
     A first delivery that died between the insert and the update would
     otherwise leave a paid participant locked out for good: the replay would
     see the duplicate, conclude "already handled", and stop. Updating only
     rows still `pending` makes the second pass free and keeps a refunded
     registration from being brought back to life by an old replay. */
  const { data: activated, error: activationError } = await admin
    .from("registrations")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", registrationId)
    .eq("status", "pending")
    .select("id");

  if (activationError) {
    console.error("[webhook] activation impossible", {
      session: session.id,
      code: activationError.code,
    });
    return { ok: false, reason: "activation-failed" };
  }

  const changed = (activated ?? []).length > 0;

  // The bonus packs of tier 3 (story 5.7). Run on every pass rather than
  // only on the one that activated: a first delivery that died after the
  // activation would otherwise leave somebody paid, active, and without the
  // packs they bought — and nothing would ever come back for them.
  //
  // It is safe to run twice. The guard is a count of what this participant
  // already received from packs, so a replay hands out nothing.
  await grantPacksForTier(registrationId);

  console.info("[webhook] paiement traité", {
    session: session.id,
    registration: registrationId,
    duplicate,
    activated: changed,
  });

  return {
    ok: true,
    outcome: changed ? "activated" : "already-processed",
  };
}
