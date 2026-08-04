import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
