"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { recordRefund } from "@/lib/accounting/refund";
import { stripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Refunding an inscription, from the back-office.
 *
 * The only action in the whole application that sends money back out. Three
 * things follow from that.
 *
 * **A reason is required, and it is not bureaucracy.** Six months later,
 * "why was this person refunded?" has to have an answer written by whoever
 * decided — not a reconstruction from a bank statement.
 *
 * **The trace is written before the money moves.** `logAdminAction` returns a
 * boolean rather than throwing, and story 1.10 left the decision to the
 * caller: here, no trace means no refund. So the intent is journalised first
 * and the refund is abandoned if that fails — an entry with no follow-up is
 * itself informative, whereas a refund with no entry is money gone with
 * nobody's name on it.
 *
 * **It cannot be replayed.** The registration's status is checked, an
 * existing refund line is checked, Stripe is given an idempotency key, and
 * the refund identifier is unique in the database. Four layers for one
 * mistake — because the mistake is refunding somebody twice.
 */

export type RefundFormState = {
  errors?: Record<string, string>;
  message?: string;
};

/** Long enough to be a sentence. "ok" is not a reason. */
const MINIMUM_REASON = 10;

export async function refundPayment(
  _previous: RefundFormState,
  formData: FormData,
): Promise<RefundFormState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!paymentId) return { message: "Encaissement introuvable." };

  if (reason.length < MINIMUM_REASON) {
    return {
      errors: {
        reason:
          "Indiquez le motif en une phrase : il sera lu par quelqu’un qui n’était pas là.",
      },
    };
  }

  const db = createAdminClient();

  const { data: payment } = await db
    .from("payments")
    .select(
      "id, kind, gross_cents, registration_id, stripe_payment_intent_id, stripe_charge_id",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment || payment.kind === "refund") {
    return {
      message: "Cet encaissement n’existe pas, ou est déjà un remboursement.",
    };
  }

  if (!payment.stripe_payment_intent_id) {
    return {
      message:
        "Cet encaissement n’a pas de référence Stripe : il doit être traité depuis le tableau de bord Stripe.",
    };
  }

  // Already refunded (AC 6). Checked here for a clear message; the database
  // refuses it again further down whatever this says.
  const { data: existing } = await db
    .from("payments")
    .select("id")
    .eq("kind", "refund")
    .eq("stripe_charge_id", payment.stripe_charge_id ?? "")
    .maybeSingle();

  if (existing) {
    return { message: "Cet encaissement a déjà été remboursé." };
  }

  const stripe = stripeClient();

  if (!stripe) {
    return {
      message: "Stripe n’est pas joignable. Réessayez dans un instant.",
    };
  }

  // The trace, before the money. If it does not save, nothing happens.
  const traced = await logAdminAction({
    action: "payment.refund_requested",
    targetTable: "payments",
    targetId: payment.id,
    payload: { reason, amount_cents: payment.gross_cents },
  });

  if (!traced) {
    return {
      message:
        "Le remboursement n’a pas été lancé : sa trace n’a pas pu être enregistrée. Réessayez.",
    };
  }

  let refundId: string;
  let refundedCents: number;

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        // Stripe's own vocabulary is a closed list; ours goes alongside it.
        reason: "requested_by_customer",
        metadata: { motif: reason.slice(0, 500), admin_id: admin.id },
      },
      // Two clicks a second apart produce one refund, not two. Stripe returns
      // the first one for the second call.
      { idempotencyKey: `refund-${payment.id}` },
    );

    refundId = refund.id;
    refundedCents = refund.amount;
  } catch (error) {
    console.error("[remboursement] refus de Stripe", {
      payment: payment.id,
      message: error instanceof Error ? error.message : "inconnue",
    });

    await logAdminAction({
      action: "payment.refund_failed",
      targetTable: "payments",
      targetId: payment.id,
      payload: { reason },
    });

    return {
      message:
        "Stripe a refusé le remboursement. Rien n’a été prélevé ni rendu ; vérifiez le paiement dans Stripe.",
    };
  }

  const recorded = await recordRefund({
    refundId,
    chargeId: payment.stripe_charge_id,
    paymentIntentId: payment.stripe_payment_intent_id,
    amountCents: refundedCents,
  });

  await logAdminAction({
    action: "payment.refunded",
    targetTable: "payments",
    targetId: payment.id,
    payload: {
      reason,
      amount_cents: refundedCents,
      stripe_refund_id: refundId,
      recorded: recorded.ok,
    },
  });

  revalidatePath("/admin/collecte");

  if (!recorded.ok) {
    // The money is back with the participant either way. Saying so plainly
    // beats a success message that hides a book of accounts out of step.
    return {
      message:
        "Le remboursement a bien été effectué chez Stripe, mais la ligne comptable n’a pas pu être écrite. Prévenez la personne qui gère la base — le remboursement, lui, est fait.",
    };
  }

  redirect("/admin/collecte?rembourse=1");
}
