import { NextResponse } from "next/server";

import { runCatchUp } from "@/lib/activities/sync";
import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";

/**
 * Fetching what the webhook missed.
 *
 * Hourly, and on the environment without the webhook subscription it is not
 * a safety net at all — it is the only way activities arrive. Strava allows
 * one subscription per application, so preproduction and production cannot
 * both have it.
 *
 * An activity found within the hour is a non-event. Found the next day, it
 * is a lost challenge and a message to the organisers.
 */
export const dynamic = "force-dynamic";

/** A sweep across every participant can take a while. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await runCatchUp();

  return NextResponse.json(
    { status: "ok", task: "rattrapage", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
