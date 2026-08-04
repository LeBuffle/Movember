import { NextResponse, type NextRequest } from "next/server";

import { ROUTES } from "@/lib/auth/routes";
import { absoluteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the links Supabase e-mails — address confirmation and
 * password reset.
 *
 * Exchanges the one-time code for a session, then sends the participant on.
 * A route handler rather than a page because it must set cookies, which a
 * server component cannot do.
 *
 * Destinations are built with `absoluteUrl`, never from the request. The
 * reason is written out in `lib/site-url.ts`, and it is not theoretical:
 * this route sent a real confirmation to `http://0.0.0.0:3000/mon-compte` —
 * the address the container binds to, which Next's standalone server returns
 * as the request origin. The confirmation itself had worked; the participant
 * simply landed nowhere.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Relative paths only: without this check, a crafted link could use this
  // route to bounce a participant to an external site right after signing in.
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.account;

  if (!code) {
    return NextResponse.redirect(
      absoluteUrl(`${ROUTES.signIn}?erreur=lien-invalide`),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`${ROUTES.signIn}?erreur=lien-expire`),
    );
  }

  return NextResponse.redirect(absoluteUrl(destination));
}
