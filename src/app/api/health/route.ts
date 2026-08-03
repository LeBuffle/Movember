import { NextResponse } from "next/server";

import { APP_ENVIRONMENT, APP_VERSION } from "@/lib/app-version";

/**
 * Health endpoint.
 *
 * Consumed by the Docker healthcheck (story 1.2), the deployment pipeline
 * (stories 1.3 and 1.4) and the external uptime monitor (story 1.11).
 *
 * At this stage it only reports that the application process is alive.
 * Story 1.11 extends it to also verify database connectivity, so that a
 * running-but-broken instance is not reported as healthy.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: APP_VERSION,
      environment: APP_ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
