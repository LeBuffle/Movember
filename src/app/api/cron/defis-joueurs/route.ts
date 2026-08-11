import { NextResponse } from "next/server";

import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";
import { sweepDuels } from "@/lib/duels/sweep";

/**
 * The hourly pass over duels between players (stories 12.5, 12.7).
 *
 * Closes what has run out of time, then reminds whoever still has a few hours
 * left. Runs during waking hours only — the crontab decides that, not this
 * file, because "pas au milieu de la nuit" is a schedule and not a condition
 * to re-derive at every call.
 *
 * Answers 200 when there was nothing to do, which is the ordinary case for
 * most of the day. A task that reports failure for a normal outcome is a task
 * whose alerts get ignored.
 */
export const dynamic = "force-dynamic";

/** Bounded: at most two hundred duels and their notifications. */
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await sweepDuels();

  return NextResponse.json(
    { status: "ok", task: "defis-joueurs", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
