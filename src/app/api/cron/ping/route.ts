import { NextResponse } from "next/server";

import { APP_ENVIRONMENT, APP_VERSION } from "@/lib/app-version";
import { cronUnauthorised, isAuthorisedCronRequest } from "@/lib/cron/auth";

/**
 * Proves the scheduled-task mechanism works, and does nothing else.
 *
 * There is no business task behind it on purpose (story 1.4 explicitly rules
 * them out). Its job is to answer one question, before any epic depends on
 * the answer: does the VPS cron actually reach the application, with the
 * right secret, on the right host?
 *
 * It stays useful afterwards. When a real scheduled task stops running in
 * November — challenges not handed out, cards not drawn — the first thing to
 * establish is whether cron reaches the application at all. This separates
 * "the plumbing is broken" from "the task is broken", which is otherwise
 * half an evening.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request)) {
    return cronUnauthorised();
  }

  return NextResponse.json(
    {
      status: "ok",
      task: "ping",
      version: APP_VERSION,
      environment: APP_ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
