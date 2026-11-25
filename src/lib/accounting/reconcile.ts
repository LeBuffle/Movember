import "server-only";

import type Stripe from "stripe";

import { handleCheckoutCompleted } from "@/lib/registration/activation";
import { stripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The net under the webhook (story 9.5).
 *
 * **This has already been needed.** On 6 August a test payment was taken by
 * Stripe while the signing secret was missing from the server: the webhook
 * refused the call, Stripe filed the matter as settled, and the registration
 * was never activated. Replaying the event by hand was the only way back.
 *
 * The webhook now answers 500 rather than 400 in that case, so Stripe retries
 * for three days. This is what catches the day three days are not enough — a
 * server down over a long weekend, an event lost for a reason nobody
 * anticipated.
 *
 * **Idempotent by construction.** Every catch-up goes through
 * `handleCheckoutCompleted`, the same door as the webhook, which already
 * refuses a second activation and a second accounting line. Nothing here
 * decides anything; it only re-presents sessions Stripe has and we have not.
 */

export type ReconcileReport = {
  /** Paid sessions Stripe knows about, within the window. */
  examined: number;
  /** Sessions with no local payment line — the gap being closed. */
  missing: number;
  /** Of those, how many were recovered. */
  recovered: number;
  /** Gaps that could not be recovered. Never silent (AC 6). */
  unrecoverable: number;
};

const EMPTY: ReconcileReport = {
  examined: 0,
  missing: 0,
  recovered: 0,
  unrecoverable: 0,
};

/** Seven days back. Longer than Stripe's own three days of retries. */
const WINDOW_DAYS = 7;

export async function reconcileCheckouts(
  client: Stripe | null = stripeClient(),
  now: Date = new Date(),
): Promise<ReconcileReport> {
  if (!client) return EMPTY;

  const since = Math.floor(
    (now.getTime() - WINDOW_DAYS * 24 * 3600 * 1000) / 1000,
  );

  let sessions: Stripe.Checkout.Session[];

  try {
    const page = await client.checkout.sessions.list({
      created: { gte: since },
      limit: 100,
    });
    sessions = page.data;
  } catch (error) {
    console.error("[réconciliation] sessions illisibles chez Stripe", {
      message: error instanceof Error ? error.message : "inconnue",
    });
    return EMPTY;
  }

  // Only paid ones. An abandoned checkout is not a gap, and treating it as one
  // would report a problem on every visitor who changed their mind.
  const paid = sessions.filter((session) => session.payment_status === "paid");

  if (paid.length === 0) {
    return { ...EMPTY, examined: 0 };
  }

  const known = await knownSessionIds(paid.map((session) => session.id));

  const report: ReconcileReport = { ...EMPTY, examined: paid.length };

  for (const session of paid) {
    if (known.has(session.id)) continue;

    report.missing += 1;

    // Through the same door as the webhook. It carries its own guards: a
    // second activation is refused, a second accounting line is refused.
    const result = await handleCheckoutCompleted(session);

    if (result.ok && result.outcome !== "ignored") {
      report.recovered += 1;
      console.warn("[réconciliation] paiement rattrapé", {
        session: session.id,
        outcome: result.outcome,
      });
      continue;
    }

    // Never swallowed. A payment that exists at Stripe and cannot be attached
    // to anybody is exactly the case a human has to see (AC 6).
    report.unrecoverable += 1;
    console.error("[réconciliation] écart non rattrapable", {
      session: session.id,
      amount: session.amount_total,
    });
  }

  console.info("[réconciliation] terminée", report);

  return report;
}

/** Which of these sessions already have an accounting line. */
async function knownSessionIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select("stripe_session_id")
    .in("stripe_session_id", ids);

  if (error) {
    // Returning "everything is known" rather than "nothing is": on an
    // unreadable table, doing nothing is safe and re-presenting a hundred
    // sessions is not.
    console.error("[réconciliation] paiements locaux illisibles", {
      code: error.code,
    });
    return new Set(ids);
  }

  return new Set(
    (data ?? [])
      .map((row) => row.stripe_session_id)
      .filter((id): id is string => Boolean(id)),
  );
}
