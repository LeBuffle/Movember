import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Turning a paid lot into credits (story 12.2).
 *
 * **Only this file credits a wallet.** The redirect the buyer follows back
 * from Stripe proves nothing — a browser triggers it, so it can be forged, and
 * on a phone it often does not happen at all. The webhook is the only
 * authority (architecture D5), exactly as for a registration or a pack.
 *
 * Everything here is built to survive being run twice. Stripe resends any
 * event that did not answer within a few seconds, and sends several events per
 * payment. The guard is a unique constraint on `purchase_id` in the ledger:
 * the second insert runs into it instead of doubling somebody's balance.
 */

export type CreditPurchaseResult =
  | { ok: true; outcome: "settled" | "already-processed" | "ignored" }
  | { ok: false; reason: string };

/** Postgres' unique-violation code — what a replayed webhook runs into. */
const UNIQUE_VIOLATION = "23505";

type PurchaseRow = {
  id: string;
  profile_id: string;
  edition_id: string;
  status: string;
  price_cents: number;
  credits: number;
};

/**
 * @returns `ok: false` when Stripe should try again. Answering 200 to a
 *   failure would have Stripe file the matter as settled: money taken, no
 *   credits, and nothing left to notice it by.
 */
export async function handleCreditPurchase(
  session: Stripe.Checkout.Session,
): Promise<CreditPurchaseResult> {
  if (session.payment_status !== "paid") {
    console.info("[défis-joueurs] session non payée, ignorée", {
      session: session.id,
      status: session.payment_status,
    });
    return { ok: true, outcome: "ignored" };
  }

  const metadata = session.metadata ?? {};
  const purchaseId =
    session.client_reference_id ?? metadata.purchase_id ?? null;

  if (!purchaseId) {
    // Unrecoverable: retrying will not add a reference that was never there.
    // Reported as handled so Stripe stops, and logged loudly — a payment
    // exists with nothing to attach it to.
    console.error("[défis-joueurs] session sans référence d’achat", {
      session: session.id,
    });
    return { ok: true, outcome: "ignored" };
  }

  const grossCents = session.amount_total ?? 0;

  if (grossCents <= 0) {
    console.error("[défis-joueurs] montant absent sur la session", {
      session: session.id,
    });
    return { ok: false, reason: "no-amount" };
  }

  const admin = createAdminClient();

  const { data, error: readError } = await admin
    .from("duel_lot_purchases")
    .select("id, profile_id, edition_id, status, price_cents, credits")
    .eq("id", purchaseId)
    .maybeSingle();

  if (readError) {
    // Readable later, most likely. Ask Stripe to come back.
    console.error("[défis-joueurs] achat illisible", { code: readError.code });
    return { ok: false, reason: "purchase-unreadable" };
  }

  const purchase = data as PurchaseRow | null;

  if (!purchase) {
    console.error("[défis-joueurs] achat introuvable", {
      session: session.id,
      purchase: purchaseId,
    });
    return { ok: true, outcome: "ignored" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  /* The accounting line first, and `kind: 'credits'` is what keeps this
     revenue distinct from the registrations and the packs in every total
     downstream (story 12.8). The whole amount is reversable: a credit posts
     nothing and prints nothing, and the unspent ones are handed over too
     (decision P8), which is why the figure can be stated without a caveat. */
  const { error: paymentError } = await admin.from("payments").insert({
    profile_id: purchase.profile_id,
    edition_id: purchase.edition_id,
    kind: "credits",
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    gross_cents: grossCents,
    // Null, never zero: Stripe does not know the fee yet. Story 2.6 fills it
    // in from the real balance transaction.
    fee_cents: null,
    net_cents: null,
    donation_cents: grossCents,
    counterpart_cents: 0,
  });

  const duplicatePayment = paymentError?.code === UNIQUE_VIOLATION;

  if (paymentError && !duplicatePayment) {
    console.error("[défis-joueurs] ligne comptable non créée", {
      session: session.id,
      code: paymentError.code,
    });
    return { ok: false, reason: "payment-insert-failed" };
  }

  const { data: settled, error: settleError } = await admin
    .from("duel_lot_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
    })
    .eq("id", purchase.id)
    .eq("status", "pending")
    .select("id");

  if (settleError && settleError.code !== UNIQUE_VIOLATION) {
    console.error("[défis-joueurs] achat non soldé", {
      session: session.id,
      code: settleError.code,
    });
    return { ok: false, reason: "settle-failed" };
  }

  /* The credits are granted on every pass rather than only on the one that
     settled. A first delivery that died between the update and the ledger
     write would otherwise leave somebody paid, settled and with an empty
     wallet, and nothing coming back for them.

     Running twice is safe: `duel_credit_entries_purchase_unique` refuses the
     second movement. That constraint is the whole idempotency of this file. */
  const { error: creditError } = await admin
    .from("duel_credit_entries")
    .insert({
      profile_id: purchase.profile_id,
      edition_id: purchase.edition_id,
      delta: purchase.credits,
      reason: "achat",
      purchase_id: purchase.id,
      stripe_session_id: session.id,
    });

  const duplicateCredit = creditError?.code === UNIQUE_VIOLATION;

  if (creditError && !duplicateCredit) {
    // The money is in and the wallet is not. Ask Stripe to come back rather
    // than declaring this settled — this is the one failure that costs a
    // participant something real.
    console.error("[défis-joueurs] crédits non versés", {
      session: session.id,
      purchase: purchase.id,
      code: creditError.code,
    });
    return { ok: false, reason: "credit-insert-failed" };
  }

  console.info("[défis-joueurs] achat de crédits traité", {
    session: session.id,
    purchase: purchase.id,
    credits: purchase.credits,
    duplicatePayment,
    duplicateCredit,
    settled: (settled ?? []).length > 0,
  });

  return {
    ok: true,
    outcome: (settled ?? []).length > 0 ? "settled" : "already-processed",
  };
}

export type LotPurchaseSummary = {
  id: string;
  lotName: string;
  status: string;
  priceCents: number;
  credits: number;
  createdAt: string;
  paidAt: string | null;
};

/**
 * What this participant has bought, most recent first.
 *
 * Read through their own session, so row level security answers. Shown under
 * the wallet: somebody who has just paid needs to see the purchase land, and
 * somebody whose credits never arrived needs something to point at.
 */
export async function listMyLotPurchases(): Promise<LotPurchaseSummary[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("duel_lot_purchases")
    .select(
      "id, status, price_cents, credits, created_at, paid_at, duel_credit_lots (name)",
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[défis-joueurs] achats illisibles", { code: error.code });
    return [];
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    status: string;
    price_cents: number;
    credits: number;
    created_at: string;
    paid_at: string | null;
    duel_credit_lots: { name: string } | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    lotName: row.duel_credit_lots?.name ?? "Lot de crédits",
    status: row.status,
    priceCents: row.price_cents,
    credits: row.credits,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  }));
}
