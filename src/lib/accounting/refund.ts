import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recording a refund.
 *
 * **A refund is a second movement, never a correction of the first**
 * (architecture D12). The payment row keeps its amounts untouched forever,
 * and a new row records the money going back out. That is what a book of
 * accounts does, and it is what makes reconciliation possible — Stripe
 * records it exactly the same way.
 *
 * One function, two callers: the back-office action that asks Stripe for the
 * refund, and the webhook that hears about refunds made straight from the
 * Stripe dashboard. Both land here, and the unique constraint on the refund
 * identifier makes it safe for both to run on the same refund.
 */

const UNIQUE_VIOLATION = "23505";

export type RefundRecord = {
  refundId: string;
  chargeId: string | null;
  /** The payment being refunded, as Stripe names it. */
  paymentIntentId: string | null;
  amountCents: number;
};

export type RefundOutcome =
  | { ok: true; outcome: "recorded" | "already-recorded" | "no-match" }
  | { ok: false; reason: string };

export async function recordRefund(
  record: RefundRecord,
): Promise<RefundOutcome> {
  const admin = createAdminClient();

  const query = admin
    .from("payments")
    .select("id, registration_id, profile_id, edition_id, gross_cents")
    .neq("kind", "refund");

  const { data: payment, error: readError } = record.paymentIntentId
    ? await query
        .eq("stripe_payment_intent_id", record.paymentIntentId)
        .maybeSingle()
    : await query.eq("stripe_charge_id", record.chargeId ?? "").maybeSingle();

  if (readError) {
    console.error("[remboursement] encaissement illisible", {
      refund: record.refundId,
      code: readError.code,
    });
    return { ok: false, reason: "read-failed" };
  }

  if (!payment) {
    // A refund for something we never recorded — a payment taken outside the
    // application, most likely. Nothing to attach it to; retrying will not
    // change that.
    console.error("[remboursement] aucun encaissement correspondant", {
      refund: record.refundId,
    });
    return { ok: true, outcome: "no-match" };
  }

  const { error: insertError } = await admin.from("payments").insert({
    registration_id: payment.registration_id,
    profile_id: payment.profile_id,
    edition_id: payment.edition_id,
    kind: "refund",
    stripe_refund_id: record.refundId,
    stripe_charge_id: record.chargeId,
    // Deliberately left empty: the original payment owns that identifier, and
    // it is unique. This row is identified by its own.
    stripe_payment_intent_id: null,
    // Positive, and subtracted where totals are computed. A negative amount
    // in the database would sum to something plausible everywhere it was
    // overlooked; this way, overlooking it shows.
    gross_cents: record.amountCents,
    // Stripe keeps its commission on a refund. Zero is a fact here, not an
    // unknown — which is the whole distinction `null` carries in story 2.6.
    fee_cents: 0,
    net_cents: -record.amountCents,
    donation_cents: 0,
    counterpart_cents: 0,
  });

  const duplicate = insertError?.code === UNIQUE_VIOLATION;

  if (insertError && !duplicate) {
    console.error("[remboursement] ligne comptable non créée", {
      refund: record.refundId,
      code: insertError.code,
    });
    return { ok: false, reason: "insert-failed" };
  }

  /* Runs even on a duplicate, for the same reason the activation does in
     story 2.4: a first attempt that died between the insert and this update
     would leave someone refunded and still playing, and the replay would see
     the duplicate and stop. */
  const fullyRefunded = record.amountCents >= payment.gross_cents;

  if (fullyRefunded && payment.registration_id) {
    const { error: statusError } = await admin
      .from("registrations")
      .update({ status: "refunded" })
      .eq("id", payment.registration_id)
      .eq("status", "active");

    if (statusError) {
      console.error("[remboursement] inscription non mise à jour", {
        refund: record.refundId,
        code: statusError.code,
      });
      return { ok: false, reason: "status-failed" };
    }
  } else if (!fullyRefunded) {
    // A partial refund does not close a registration. Worth saying out loud:
    // it is the one case where money went back and the person still plays.
    console.warn("[remboursement] remboursement partiel, accès conservé", {
      refund: record.refundId,
      refunded: record.amountCents,
      paid: payment.gross_cents,
    });
  }

  console.info("[remboursement] enregistré", {
    refund: record.refundId,
    duplicate,
    fullyRefunded,
  });

  return { ok: true, outcome: duplicate ? "already-recorded" : "recorded" };
}
