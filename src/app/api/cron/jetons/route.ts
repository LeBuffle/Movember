import { NextResponse } from "next/server";

import { refreshExpiringConnections } from "@/lib/activities/refresh";
import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";

/**
 * Renewing the provider tokens that are about to expire.
 *
 * Hourly, and ahead of need. A Strava token lasts a few hours: without this
 * task, every link made during the game would die overnight and each
 * participant would discover it by losing a challenge.
 *
 * Answers 200 with a report even when some links could not be renewed. The
 * distinction matters: a task that reports failure for a partial run is a
 * task whose alerts stop being read, and the links that *were* renewed must
 * not be renewed again by a retry. What raises the alarm is the log line,
 * which reaches Sentry (story 1.11).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await refreshExpiringConnections();

  return NextResponse.json(
    { status: "ok", task: "jetons", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
