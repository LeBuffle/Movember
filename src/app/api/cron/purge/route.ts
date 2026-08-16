import { NextResponse } from "next/server";

import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";
import { runRetentionPurge } from "@/lib/privacy/purge";

/**
 * The retention policy, applied (story 11.4).
 *
 * Daily rather than hourly: the delays are counted in months, and nothing here
 * becomes urgent within a day.
 *
 * **It reports zero for eleven months of the year.** The first rule falls due
 * one month after the edition ends. A task whose ordinary answer is "rien à
 * faire" is a task that has to say so plainly, or nobody will believe it when
 * it finally does something.
 */
export const dynamic = "force-dynamic";

/** Deleting several months of rows can take a moment. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  const report = await runRetentionPurge();

  return NextResponse.json(
    { status: "ok", task: "purge", ...report },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
