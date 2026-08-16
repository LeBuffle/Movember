import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mayConnectActivitySource } from "@/lib/activities/consent";
import { STATE_COOKIE, STATE_TTL_SECONDS } from "@/lib/activities/oauth-state";
import { encryptionAvailable } from "@/lib/activities/crypto";
import { activitySource, isConnectable } from "@/lib/activities/sources";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Sending the participant off to authorise us.
 *
 * A route rather than a link with a fixed URL, because three things have to
 * be true before the redirection exists at all — a session, a consent, and a
 * `state` that did not come from the request. None of them can be checked in
 * an `href`.
 *
 * **The consent is checked here, not only on the screen** (story 3.2 AC 6).
 * The screen hides the button when consent is missing; hiding a button is a
 * courtesy, not a control, and this is the control.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fournisseur: string }> },
) {
  const { fournisseur } = await params;

  const back = (error: string) =>
    NextResponse.redirect(
      absoluteUrl(`/mon-compte/activites?erreur=${error}`),
      // 303: the browser must follow with a GET, and must not offer to
      // replay this URL from history as anything else.
      { status: 303 },
    );

  if (!isConnectable(fournisseur)) return back("inconnu");

  const source = activitySource(fournisseur);
  if (!source) return back("inconnu");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return back("session");

  if (!(await mayConnectActivitySource())) return back("consentement");

  // Refused before the participant leaves rather than after they come back:
  // sending someone to Strava, having them approve, and only then finding we
  // cannot store the result is the worst possible order.
  if (!encryptionAvailable()) return back("configuration");

  const state = randomBytes(32).toString("hex");

  const redirectUri = absoluteUrl(`/api/activites/retour/${fournisseur}`);
  const authorization = source.authorizationUrl(state, redirectUri);

  if (!authorization.ok) return back("configuration");

  const jar = await cookies();

  // `lax` and not `strict`: the participant comes back through a redirection
  // from strava.com, and a strict cookie would not be sent on that hop — the
  // return would then fail for everybody, every time.
  jar.set(STATE_COOKIE, `${fournisseur}:${state}`, {
    httpOnly: true,
    secure: request.url.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  return NextResponse.redirect(authorization.value, { status: 303 });
}
