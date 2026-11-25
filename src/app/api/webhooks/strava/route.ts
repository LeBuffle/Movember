import { after, NextResponse } from "next/server";

import { handleStravaEvent, readStravaEvent } from "@/lib/activities/webhook";

/**
 * Strava telling us something happened.
 *
 * **Answer first, work after.** Strava expects a reply within a couple of
 * seconds and retries when it does not get one — so fetching the activity's
 * detail and evaluating the challenges inside the request would get the event
 * replayed while we are still handling it. The reply goes out immediately and
 * the work runs behind it.
 *
 * **On authenticity, plainly: Strava does not sign these calls.** There is no
 * secret to check, so "authenticated" cannot mean what it means for the
 * Stripe webhook (story 2.4). What protects this route instead:
 *
 *   - the subscription identifier and athlete are checked against a link we
 *     actually hold, so a payload naming a stranger is dropped;
 *   - **nothing in the payload is ever stored.** It carries an identifier,
 *     and we go and ask Strava ourselves for the activity — with the
 *     participant's own token. A forged call can therefore make us spend one
 *     API call on an athlete we know, and nothing more. It cannot inject a
 *     40 km run.
 *
 * Excluded from the session middleware, like every webhook: it has no cookie
 * and never will.
 */
export const dynamic = "force-dynamic";

/**
 * Strava's subscription handshake.
 *
 * Called once, when the subscription is created: it sends a challenge and
 * expects it echoed back alongside a token we chose. Getting this wrong is
 * the reason a subscription silently refuses to be created.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (
    !expected ||
    url.searchParams.get("hub.mode") !== "subscribe" ||
    url.searchParams.get("hub.verify_token") !== expected
  ) {
    // 403 rather than 404: Strava's own documentation expects a refusal here,
    // and a "not found" would send whoever is setting this up looking for a
    // routing problem that does not exist.
    return NextResponse.json({ error: "verify_token" }, { status: 403 });
  }

  const challenge = url.searchParams.get("hub.challenge") ?? "";

  // The exact key Strava looks for. A different one fails the handshake with
  // no explanation whatsoever.
  return NextResponse.json({ "hub.challenge": challenge });
}

export async function POST(request: Request) {
  const event = readStravaEvent(await request.json().catch(() => null));

  if (!event) {
    // 200 on a payload we cannot read, deliberately. Strava retries a
    // non-200, and retrying something malformed produces the same result
    // forever while counting against the subscription's health.
    console.warn("[strava] événement illisible");
    return NextResponse.json({ status: "ignored" });
  }

  // The work happens after the response has gone out.
  after(async () => {
    try {
      const outcome = await handleStravaEvent(event);

      console.info("[strava] événement traité", {
        aspect: event.aspectType,
        object: event.objectType,
        outcome,
      });
    } catch (error) {
      // Nothing above catches this: `after` runs outside the request, so an
      // exception here would vanish without a trace.
      console.error("[strava] traitement en échec", {
        aspect: event.aspectType,
        message: error instanceof Error ? error.message : "inconnue",
      });
    }
  });

  return NextResponse.json({ status: "ok" });
}
