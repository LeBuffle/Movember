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
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|api/webhooks|api/cron|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
