import { NextResponse } from "next/server";

import { sweepPendingFees } from "@/lib/accounting/fees";
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

  const report = await sweepPendingFees();

  return NextResponse.json(
    {
      status: "ok",
      task: "rapprochement",
      ...report,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
