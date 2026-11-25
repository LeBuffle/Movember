import "server-only";

import type Stripe from "stripe";

import type { Rarity } from "@/lib/cards/draw";
import { grantPurchasedPack } from "@/lib/packs/grant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Turning a paid pack into cards (story 10.3).
 *
 * **Only this file settles a purchase.** The redirect the buyer follows back
 * from Stripe proves nothing — a browser triggers it, so it can be forged,
 * and on a phone it often does not happen at all. The webhook is the only
 * authority (architecture D5), exactly as for a registration.
 *
 * Everything here is built to survive being run twice. Stripe resends any
 * event that did not answer within a few seconds, and sends several events
 * per payment.
 */

export type PurchaseResult =
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
  card_count: number;
  guaranteed_rarity: string | null;
};

/**
 * @returns `ok: false` when Stripe should try again. Answering 200 to a
 *   failure would have Stripe file the matter as settled: money taken, no
 *   cards, and nothing left to notice it by.
 */
export async function handlePackPurchase(
  session: Stripe.Checkout.Session,
): Promise<PurchaseResult> {
  if (session.payment_status !== "paid") {
    console.info("[packs] session non payée, ignorée", {
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
    console.error("[packs] session sans référence d’achat", {
      session: session.id,
    });
    return { ok: true, outcome: "ignored" };
  }

  const grossCents = session.amount_total ?? 0;

  if (grossCents <= 0) {
    console.error("[packs] montant absent sur la session", {
      session: session.id,
    });
    return { ok: false, reason: "no-amount" };
  }

  const admin = createAdminClient();

  const { data, error: readError } = await admin
    .from("pack_purchases")
    .select(
      "id, profile_id, edition_id, status, price_cents, card_count, guaranteed_rarity",
    )
    .eq("id", purchaseId)
    .maybeSingle();

  if (readError) {
    // Readable later, most likely. Ask Stripe to come back.
    console.error("[packs] achat illisible", { code: readError.code });
    return { ok: false, reason: "purchase-unreadable" };
  }

  const purchase = data as PurchaseRow | null;

  if (!purchase) {
    console.error("[packs] achat introuvable", {
      session: session.id,
      purchase: purchaseId,
    });
    return { ok: true, outcome: "ignored" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  /* The accounting line first, and `kind: 'pack'` is what keeps this revenue
     distinct from the registrations in every total downstream (story 10.5).
     The whole amount is reversable: a pack posts nothing and prints nothing,
     which the database constraint on `card_packs` already enforces. */
  const { error: paymentError } = await admin.from("payments").insert({
    // No registration: a pack is bought on its own. The column is nullable
    // precisely so a payment survives having nothing to hang from.
    profile_id: purchase.profile_id,
    edition_id: purchase.edition_id,
    kind: "pack",
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

  const duplicate = paymentError?.code === UNIQUE_VIOLATION;

  if (paymentError && !duplicate) {
    console.error("[packs] ligne comptable non créée", {
      session: session.id,
      code: paymentError.code,
    });
    return { ok: false, reason: "payment-insert-failed" };
  }

  const { data: settled, error: settleError } = await admin
    .from("pack_purchases")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", purchase.id)
    .eq("status", "pending")
    .select("id");

  if (settleError) {
    console.error("[packs] achat non soldé", {
      session: session.id,
      code: settleError.code,
    });
    return { ok: false, reason: "settle-failed" };
  }

  /* The cards are drawn on every pass rather than only on the one that
     settled. A first delivery that died between the update and the draw would
     otherwise leave somebody paid, settled and empty-handed, with nothing
     coming back for them. Running twice is safe: the guard is a count of the
     grants already carrying this purchase. */
  const outcome = await grantPurchasedPack({
    id: purchase.id,
    profileId: purchase.profile_id,
    editionId: purchase.edition_id,
    cardCount: purchase.card_count,
    guaranteedRarity: purchase.guaranteed_rarity as Rarity | null,
  });

  console.info("[packs] achat traité", {
    session: session.id,
    purchase: purchase.id,
    duplicate,
    settled: (settled ?? []).length > 0,
    cards: outcome.granted,
  });

  return {
    ok: true,
    outcome: (settled ?? []).length > 0 ? "settled" : "already-processed",
  };
}

export type PurchaseSummary = {
  id: string;
  packName: string;
  status: string;
  priceCents: number;
  cardCount: number;
  createdAt: string;
  paidAt: string | null;
  /** How many of its cards are still waiting to be opened. */
  unopened: number;
};

/**
 * What this participant has bought, most recent first.
 *
 * Read through their own session, so row level security answers. Shown under
 * the shop: somebody who has just paid needs to see the purchase land, and
 * somebody whose cards never arrived needs something to point at.
 */
export async function listMyPurchases(): Promise<PurchaseSummary[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("pack_purchases")
    .select(
      "id, status, price_cents, card_count, created_at, paid_at, card_packs (name)",
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[packs] achats illisibles", { code: error.code });
    return [];
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    status: string;
    price_cents: number;
    card_count: number;
    created_at: string;
    paid_at: string | null;
    card_packs: { name: string } | null;
  }>;

  if (rows.length === 0) return [];

  const { data: grants } = await supabase
    .from("card_grants")
    .select("pack_purchase_id, revealed_at")
    .in(
      "pack_purchase_id",
      rows.map((row) => row.id),
    );

  const unopened = new Map<string, number>();

  for (const grant of grants ?? []) {
    if (grant.revealed_at !== null || !grant.pack_purchase_id) continue;
    unopened.set(
      grant.pack_purchase_id,
      (unopened.get(grant.pack_purchase_id) ?? 0) + 1,
    );
  }

  return rows.map((row) => ({
    id: row.id,
    packName: row.card_packs?.name ?? "Pack",
    status: row.status,
    priceCents: row.price_cents,
    cardCount: row.card_count,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    unopened: unopened.get(row.id) ?? 0,
  }));
}
