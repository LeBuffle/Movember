import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  isAuthRoute,
  requiresAdmin,
  requiresSession,
  ROUTES,
} from "@/lib/auth/routes";
import type { Database } from "@/types/database";

/**
 * Refreshes the session on every request and enforces route protection.
 *
 * Two jobs, and the first one is easy to overlook: Supabase access tokens are
 * short-lived, so without a refresh here a participant would be signed out
 * mid-game. This is also what keeps the session alive inside an installed
 * PWA, where the app can sit unopened for hours.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` rather than `getSession()`: it revalidates the token against
  // Supabase. `getSession()` trusts the cookie, which a client can forge —
  // it must never be what guards a protected route.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && requiresSession(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.signIn;
    // Remembers where they were headed so the sign-in form can send them
    // back there instead of dropping them on the home page.
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  if (user && requiresAdmin(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      // Rewritten to the not-found page rather than redirected: a redirect
      // would confirm that /admin exists to someone probing for it.
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }

  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.account;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
