import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { APP_ENVIRONMENT, APP_VERSION } from "@/lib/app-version";

/**
 * Health endpoint, in two modes.
 *
 * The distinction matters more than it looks, and getting it wrong is how a
 * good deployment gets rolled back at three in the morning.
 *
 * - **Liveness** (default, `/api/health`): does this process answer? Nothing
 *   else. Consumed by the Docker healthcheck (story 1.2) and by the
 *   deployment pipeline (stories 1.3 and 1.4), which waits for the container
 *   to report healthy before considering a deploy successful.
 *
 * - **Deep** (`/api/health?deep=1`): does the application actually work,
 *   database included? This is what the external monitor watches (AC 1), and
 *   the only mode that can answer 503.
 *
 * Why not a single deep check everywhere: Supabase is not ours. An outage on
 * their side would make our container report unhealthy, and the deployment
 * script would roll back perfectly good code to a version that is just as
 * unable to reach Supabase. The container is alive; it is the world around
 * it that is not, and only a human can act on that.
 */
export const dynamic = "force-dynamic";

/** Beyond this, the database is treated as unreachable. */
const DATABASE_TIMEOUT_MS = 3000;

type CheckResult = {
  ok: boolean;
  latencyMs: number;
  /** Coarse reason. Never the raw driver message — this endpoint is public. */
  reason?: string;
};

/**
 * Asks the database the cheapest question that proves it answered.
 *
 * Counts published editions with `head: true`, so Postgres returns a count
 * and no rows. A result of zero is a success: what is being tested is that
 * the query completed, not what it found. Row level security is therefore
 * irrelevant here, which is deliberate — a health probe carries no identity.
 */
async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { ok: false, latencyMs: 0, reason: "not-configured" };
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase
      .from("editions")
      .select("id", { count: "exact", head: true })
      // Without this, a Supabase outage leaves the probe hanging until the
      // monitor times out on its side — which reports "site down" rather
      // than "database down", and sends someone looking in the wrong place.
      .abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));

    const latencyMs = Date.now() - started;

    if (error) {
      return { ok: false, latencyMs, reason: "query-failed" };
    }

    return { ok: true, latencyMs };
  } catch {
    // Thrown rather than returned: a timeout or a DNS failure lands here.
    return {
      ok: false,
      latencyMs: Date.now() - started,
      reason: "unreachable",
    };
  }
}

/**
 * Whether the server picked up the e-mail configuration (story 2.5).
 *
 * **Three booleans, and never a value.** Not the key — obviously — but not the
 * sending address either: this endpoint is public, and an address published on
 * a health check is an address that gets harvested. What is answered is
 * "did the server see them", which is the one question somebody has after
 * pasting them into a file on the VPS.
 *
 * It never changes the status. A missing e-mail service is not a degraded
 * site: nobody is stopped from registering or playing by it, and reporting
 * `degraded` would have the external monitor wake somebody at night over a
 * variable that has been empty for months on purpose.
 */
function checkEmail(): {
  apiKey: boolean;
  fromAddress: boolean;
  replyTo: boolean;
} {
  return {
    apiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    fromAddress: Boolean(process.env.RESEND_FROM_ADDRESS?.trim()),
    replyTo: Boolean(process.env.RESEND_REPLY_TO?.trim()),
  };
}

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";

  const base = {
    version: APP_VERSION,
    environment: APP_ENVIRONMENT,
    timestamp: new Date().toISOString(),
  };

  const headers = { "Cache-Control": "no-store" };

  if (!deep) {
    return NextResponse.json(
      { status: "ok", ...base },
      { status: 200, headers },
    );
  }

  const database = await checkDatabase();

  return NextResponse.json(
    {
      status: database.ok ? "ok" : "degraded",
      ...base,
      checks: { database, email: checkEmail() },
    },
    // 503 rather than 500: the application is not broken, it is unable to
    // serve. It is also the status monitors treat as "down" without
    // reporting an application error.
    { status: database.ok ? 200 : 503, headers },
  );
}
