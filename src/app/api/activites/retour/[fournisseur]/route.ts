import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mayConnectActivitySource } from "@/lib/activities/consent";
import { linkAccount } from "@/lib/activities/connection";
import { secretsMatch } from "@/lib/activities/crypto";
import { STATE_COOKIE } from "@/lib/activities/oauth-state";
import { activitySource, isConnectable } from "@/lib/activities/sources";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Coming back from the provider.
 *
 * **The `state` is what stops a forced link.** Without it, a link prepared by
 * somebody else — sent by message, clicked once — attaches *their* Strava
 * account to the victim's game account, and every activity they record then
 * scores for the victim. The value is generated server-side, kept in an
 * httpOnly cookie, compared here, and burned whatever the outcome.
 *
 * **Nothing half-linked is ever left behind** (AC 7). Every failure below
 * returns to the participant's screen with a reason and no row written; the
 * only write happens once the exchange has fully succeeded.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fournisseur: string }> },
) {
  const { fournisseur } = await params;
  const url = new URL(request.url);
  const jar = await cookies();

  const finish = (query: string) => {
    const response = NextResponse.redirect(
      absoluteUrl(`/mon-compte/activites?${query}`),
      { status: 303 },
    );

    // One authorisation, one state. Cleared on the way out whatever happened,
    // so a replayed callback finds nothing to match against.
    response.cookies.delete(STATE_COOKIE);

    return response;
  };

  if (!isConnectable(fournisseur)) return finish("erreur=inconnu");

  const source = activitySource(fournisseur);
  if (!source) return finish("erreur=inconnu");

  // Strava sends `error=access_denied` when the participant says no. That is
  // a decision, not a failure, and it deserves its own message.
  if (url.searchParams.get("error")) return finish("erreur=refus");

  const expected = jar.get(STATE_COOKIE)?.value ?? "";
  const received = url.searchParams.get("state") ?? "";

  if (!expected || !secretsMatch(expected, `${fournisseur}:${received}`)) {
    return finish("erreur=etat");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return finish("erreur=session");

  // Re-checked on the way back too: a consent withdrawn in another tab while
  // Strava's screen was open must not produce a link.
  if (!(await mayConnectActivitySource())) return finish("erreur=consentement");

  const code = url.searchParams.get("code");
  if (!code) return finish("erreur=echange");

  const exchanged = await source.exchangeCode(
    code,
    absoluteUrl(`/api/activites/retour/${fournisseur}`),
  );

  if (!exchanged.ok) {
    console.error("[connexion] échange refusé", {
      provider: fournisseur,
      reason: exchanged.reason,
    });

    return finish(
      exchanged.reason === "unavailable"
        ? "erreur=injoignable"
        : "erreur=echange",
    );
  }

  // Strava reports the granted scopes on the callback, not in the token
  // response — and they can be narrower than what was asked. Recording what
  // was actually granted is what makes a later "403" explainable.
  const granted = (url.searchParams.get("scope") ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  // The resolved source's own key, not the raw URL segment: the registry is
  // what decides which providers exist.
  const linked = await linkAccount(user.id, source.key, {
    ...exchanged.value,
    scopes: granted,
  });

  if (!linked.ok) {
    return finish(
      linked.reason === "taken"
        ? "erreur=deja-lie"
        : linked.reason === "encryption"
          ? "erreur=configuration"
          : "erreur=enregistrement",
    );
  }

  // The trace of the link is the row itself (AC 8): who, when, which athlete,
  // and when it was unlinked — because unlinking stamps a date rather than
  // deleting. A second journal beside it would be the same facts kept twice,
  // and the copy that drifts is always the one somebody reads.
  //
  // Not `admin_audit_log`: that table is for administrators acting on other
  // people, and its policy refuses a participant's own insert outright.
  console.info("[connexion] compte sportif lié", {
    provider: fournisseur,
    athlete: exchanged.value.providerAccountId,
  });

  return finish("connecte=1");
}
