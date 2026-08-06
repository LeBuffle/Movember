import { NextResponse } from "next/server";

import { assignDailyChallenges } from "@/lib/challenges/daily-draw";
import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";
import { notifyDailyChallenges } from "@/lib/notifications/game";

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

  /* The notification comes after the draw and never conditions it (story 6.5
     AC 7). Whatever happens here, the challenges are handed out — a send that
     fails must not leave somebody staring at an empty screen while their
     challenge existed all along.

     It reads the day's assignments rather than trusting the report above, so
     a task relaunched at nine still notifies the people served at six. */
  const notified = await notifyDailyChallenges(report.date);

  return NextResponse.json(
    { status: "ok", task: "defis-du-jour", ...report, notified },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
