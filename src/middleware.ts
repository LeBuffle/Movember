import { NextResponse, type NextRequest } from "next/server";

import {
  GATE_COOKIE,
  gateCode,
  gateTokenMatches,
  isOpenPath,
} from "@/lib/gate/access";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const code = gateCode();

  // The preproduction gate, before anything else — including before the
  // Supabase round-trip, which there is no point paying for a visitor who is
  // not getting a page.
  if (code && !isOpenPath(request.nextUrl.pathname)) {
    const presented = request.cookies.get(GATE_COOKIE)?.value;

    if (!(await gateTokenMatches(presented, code))) {
      const url = request.nextUrl.clone();
      url.pathname = "/acces";
      url.search = "";
      // Rewritten, not redirected: the address stays the one that was asked
      // for, so the entry screen can send the visitor there once they are
      // through — and a bookmarked link still works after the code.
      //
      // **The query string travels too, and that is not a nicety.** The links
      // that matter most here carry everything in it: an e-mail confirmation
      // (`/auth/confirmation?code=…`), a password reset, the return from
      // Strava. Keeping only the path would drop the very token the page
      // needs, and the failure would look like "the link is broken" rather
      // than "the gate ate it".
      url.searchParams.set(
        "suite",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );

      return NextResponse.rewrite(url);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Runs on every page so sessions stay refreshed, but skips what would
     * only waste a Supabase round-trip:
     *   - Next.js internals and static assets
     *   - the PWA files, which must stay reachable without a session
     *   - webhook and cron routes, which authenticate by signature or secret
     *     rather than by cookie
     *
     * `hors-ligne` is excluded for a stronger reason than saving a call: the
     * service worker keeps a copy of that page in the device cache, and this
     * middleware refreshes the session, which means the response carries
     * `Set-Cookie`. Storing an authentication token in a cache the
     * participant does not know exists is exactly what story 1.8 AC 7
     * forbids. The page needs no session anyway.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|swe-worker|robots.txt|hors-ligne|api/webhooks|api/cron|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
