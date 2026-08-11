import { NextResponse } from "next/server";

import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";
import { snapshotLeaderboardRanks } from "@/lib/leaderboards/snapshot";

/**
 * The daily photograph of the rankings (story 13.1).
 *
 * Runs a couple of minutes before the day's challenges, so that "depuis hier
 * matin" refers to the state a participant last saw — before today's game
 * started moving anything.
 *
 * Answers 200 when the photograph was already taken. That is the guard
 * working, not a failure, and a task that reports failure for a normal
 * outcome is a task whose alerts get ignored.
 */
export const dynamic = "force-dynamic";

/** One insert over the edition. Bounded, but not instant at 800 rows. */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await snapshotLeaderboardRanks();

  return NextResponse.json(
    { status: "ok", task: "photographie", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
