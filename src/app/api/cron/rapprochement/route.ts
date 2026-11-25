import { NextResponse } from "next/server";

import { sweepPendingFees } from "@/lib/accounting/fees";
import { reconcileCheckouts } from "@/lib/accounting/reconcile";
import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";

/**
 * Catches up every accounting line whose fee is still unknown.
 *
 * **The webhook is not enough, and cannot be.** A balance transaction is not
 * always ready when the charge succeeds, a delivery can be lost, and the
 * application can be restarting at the wrong second. Any of those leaves a
 * payment line permanently incomplete — and an incomplete line is one the
 * association cannot reconcile against its Stripe statement, at the moment it
 * has to justify what it handed to the foundation.
 *
 * So this runs on a schedule and fixes whatever the webhook missed. It is
 * deliberately dull: it never invents a figure, it only asks Stripe again.
 *
 * Answers 200 even when nothing could be completed. Nothing depends on this
 * reply — it goes into a log file — and a scheduled task that reports failure
 * for a fee that is simply not ready yet is a task whose alerts get ignored.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  // Two passes, and they answer two different questions. The fees are the
  // ordinary one: a balance transaction Stripe had not produced yet. The
  // reconciliation is the rare and serious one: a payment Stripe took that
  // never reached us at all (story 9.5).
  const [fees, reconciliation] = await Promise.all([
    sweepPendingFees(),
    reconcileCheckouts(),
  ]);

  return NextResponse.json(
    {
      status: "ok",
      task: "rapprochement",
      frais: fees,
      reconciliation,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
