import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe/client";

/**
 * The real fee Stripe took, written onto the accounting line.
 *
 * **Never estimated** (architecture D12, NFR15). "About 1.4 % + 0.25 €" is
 * wrong for a good share of payments — a non-European card, a commercial
 * card, a different payment method each carry their own rate — and the
 * difference shows up on the statement, at the exact moment the association
 * has to justify what it handed over.
 *
 * The fee is not known when the payment webhook fires. It lives on the
 * *balance transaction*, which Stripe produces a moment later. So the line is
 * written first without it (story 2.4) and completed here — and only ever on
 * those three columns. Everything already recorded about the money stays
 * untouched: the immutability of story 2.1 is about what has been written,
 * not about a column still empty.
 *
 * Two ways in, on purpose:
 *
 *   - the `charge.succeeded` webhook, which covers the normal case within
 *     seconds;
 *   - a scheduled sweep, which covers the ones the first way missed — a
 *     balance transaction not ready yet, a webhook delivery lost, an outage
 *     on our side. Relying on the webhook alone would leave a payment
 *     permanently incomplete with nothing to notice it by.
 */

export type FeeOutcome =
  | { ok: true; outcome: "recorded" | "unchanged" | "not-ready" | "no-match" }
  | { ok: false; reason: string };

export type Fees = {
  fee_cents: number;
  net_cents: number;
};

/**
 * Reads the fee off a balance transaction.
 *
 * @returns `null` when the figures cannot be trusted, rather than a plausible
 * number. A wrong fee is worse than a missing one: the missing one is
 * flagged and chased, the wrong one is added to a total and believed.
 */
export function feesFrom(
  transaction: Pick<
    Stripe.BalanceTransaction,
    "fee" | "net" | "amount" | "currency"
  >,
  expectedGrossCents?: number,
): Fees | null {
  if (
    !Number.isInteger(transaction.fee) ||
    !Number.isInteger(transaction.net) ||
    transaction.fee < 0
  ) {
    return null;
  }

  // The balance transaction is denominated in the account's settlement
  // currency. Ours is euros; anything else means a conversion happened, and
  // the figures are no longer comparable to what was charged.
  if (transaction.currency !== "eur") {
    console.error("[frais] transaction dans une autre devise", {
      currency: transaction.currency,
    });
    return null;
  }

  if (
    expectedGrossCents !== undefined &&
    transaction.amount !== expectedGrossCents
  ) {
    // Not a refusal — Stripe is the authority on what it moved. But it means
    // the line and the statement will not line up, and someone should know
    // before the reconciliation rather than during it.
    console.warn("[frais] montant de la transaction différent du brut", {
      settled: transaction.amount,
      recorded: expectedGrossCents,
    });
  }

  return { fee_cents: transaction.fee, net_cents: transaction.net };
}

/** The balance transaction, whether Stripe expanded it or sent an id. */
async function resolveBalanceTransaction(
  reference: string | Stripe.BalanceTransaction | null | undefined,
  client: Stripe,
): Promise<Stripe.BalanceTransaction | null> {
  if (!reference) return null;
  if (typeof reference !== "string") return reference;

  try {
    return await client.balanceTransactions.retrieve(reference);
  } catch (error) {
    console.error("[frais] transaction de solde illisible", {
      id: reference,
      message: error instanceof Error ? error.message : "inconnue",
    });
    return null;
  }
}

/**
 * Writes the fee onto the payment line matched by its payment intent.
 *
 * Touches three columns and no others. Rewriting a fee that was already known
 * is allowed — Stripe restating its own figures is Stripe's prerogative — but
 * it is logged, because it should be rare and it changes a total someone may
 * already have reported.
 */
async function writeFees(
  paymentIntentId: string,
  chargeId: string | null,
  fees: Fees,
): Promise<FeeOutcome> {
  const admin = createAdminClient();

  const { data: existing, error: readError } = await admin
    .from("payments")
    .select("id, fee_cents, gross_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (readError) {
    console.error("[frais] ligne comptable illisible", {
      intent: paymentIntentId,
      code: readError.code,
    });
    return { ok: false, reason: "read-failed" };
  }

  if (!existing) {
    // The payment webhook may simply not have arrived yet — Stripe does not
    // order its deliveries. Reported as handled so Stripe stops retrying;
    // the scheduled sweep picks the line up once it exists.
    console.info("[frais] aucune ligne comptable pour ce paiement", {
      intent: paymentIntentId,
    });
    return { ok: true, outcome: "no-match" };
  }

  if (existing.fee_cents === fees.fee_cents) {
    return { ok: true, outcome: "unchanged" };
  }

  if (existing.fee_cents !== null) {
    console.warn("[frais] frais déjà connus, corrigés par Stripe", {
      intent: paymentIntentId,
      previous: existing.fee_cents,
      updated: fees.fee_cents,
    });
  }

  const { error } = await admin
    .from("payments")
    .update({
      fee_cents: fees.fee_cents,
      net_cents: fees.net_cents,
      stripe_charge_id: chargeId,
    })
    .eq("id", existing.id);

  if (error) {
    console.error("[frais] écriture impossible", {
      intent: paymentIntentId,
      code: error.code,
    });
    return { ok: false, reason: "write-failed" };
  }

  console.info("[frais] ligne complétée", {
    intent: paymentIntentId,
    fee: fees.fee_cents,
  });

  return { ok: true, outcome: "recorded" };
}

/** The webhook path: a charge just succeeded. */
export async function recordFeesFromCharge(
  charge: Stripe.Charge,
  client: Stripe | null = stripeClient(),
): Promise<FeeOutcome> {
  if (!client) return { ok: false, reason: "stripe-unavailable" };

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    console.error("[frais] charge sans paiement rattaché", {
      charge: charge.id,
    });
    return { ok: true, outcome: "no-match" };
  }

  const transaction = await resolveBalanceTransaction(
    charge.balance_transaction,
    client,
  );

  if (!transaction) {
    // Normal for a moment after payment, and for some methods much longer.
    // Not an error: the sweep will come back for it.
    return { ok: true, outcome: "not-ready" };
  }

  const fees = feesFrom(transaction, charge.amount);

  if (!fees) return { ok: true, outcome: "not-ready" };

  return writeFees(paymentIntentId, charge.id, fees);
}

export type SweepReport = {
  examined: number;
  recorded: number;
  stillPending: number;
};

/**
 * The scheduled sweep: every line whose fee is still unknown.
 *
 * Bounded on purpose. A run that tries to fix a thousand lines in one go is a
 * run that times out halfway and leaves nobody the wiser; a bounded one that
 * runs again in an hour converges just as surely and is legible in the logs.
 */
export async function sweepPendingFees(
  limit = 50,
  client: Stripe | null = stripeClient(),
): Promise<SweepReport> {
  if (!client) return { examined: 0, recorded: 0, stillPending: 0 };

  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("payments")
    .select("stripe_payment_intent_id")
    .is("fee_cents", null)
    .not("stripe_payment_intent_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[frais] lignes en attente illisibles", { code: error.code });
    return { examined: 0, recorded: 0, stillPending: 0 };
  }

  let recorded = 0;

  for (const row of pending ?? []) {
    const intentId = row.stripe_payment_intent_id;
    if (!intentId) continue;

    try {
      const intent = await client.paymentIntents.retrieve(intentId, {
        expand: ["latest_charge.balance_transaction"],
      });

      const charge =
        typeof intent.latest_charge === "string"
          ? null
          : (intent.latest_charge ?? null);

      if (!charge) continue;

      const result = await recordFeesFromCharge(charge, client);
      if (result.ok && result.outcome === "recorded") recorded += 1;
    } catch (error) {
      // One unreadable payment must not stop the sweep: the next run will
      // try again, and the others deserve to be fixed meanwhile.
      console.error("[frais] paiement illisible chez Stripe", {
        intent: intentId,
        message: error instanceof Error ? error.message : "inconnue",
      });
    }
  }

  const examined = (pending ?? []).length;

  console.info("[frais] rapprochement terminé", {
    examined,
    recorded,
    stillPending: examined - recorded,
  });

  return { examined, recorded, stillPending: examined - recorded };
}
