import { NextResponse } from "next/server";

import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";
import { refreshLeaderboards } from "@/lib/leaderboards/refresh";

/**
 * The rankings, recomputed.
 *
 * Every fifteen minutes. **A ranking recomputed on every page load, for 800
 * participants, would be both expensive and unstable** — and this is the
 * screen people open several times a day. Fifteen minutes of lag is
 * irrelevant in a game that lasts a month; a leaderboard that takes four
 * seconds to open is not.
 *
 * Answers 200 even when another refresh was already running. That is not a
 * failure — it is the guard working — and a task that reports failure for a
 * normal outcome is a task whose alerts get ignored.
 */
export const dynamic = "force-dynamic";

/** A full recomputation over the edition. Comfortably bounded, but not free. */
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await refreshLeaderboards();

  return NextResponse.json(
    { status: "ok", task: "classements", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
