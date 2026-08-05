import { NextResponse } from "next/server";

import { assignDailyChallenges } from "@/lib/challenges/daily-draw";
import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";

/**
 * The day's challenges, handed out.
 *
 * The one scheduled task the month actually depends on. It runs early, it can
 * be re-run at any hour without harm, and it says in its answer exactly what
 * it did — because the morning it goes wrong, somebody will be reading a log
 * file on a phone.
 *
 * Answers 200 with a report rather than an error when some participants could
 * not be served. The distinction matters: a task that reports failure for a
 * partial run is a task whose alerts get ignored, and the participants who
 * *were* served must not be re-served by a retry. What raises the alarm is
 * the log line, which reaches Sentry (story 1.11).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await assignDailyChallenges();

  return NextResponse.json(
    { status: "ok", task: "defis-du-jour", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
