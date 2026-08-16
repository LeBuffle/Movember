import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

/**
 * Supabase client for server components, server actions and route handlers.
 *
 * Acts as the signed-in user: still bound by row level security, which is
 * what makes it safe to use in pages. For the rare operations that must
 * bypass those policies — webhooks, scheduled jobs — see `admin.ts`.
 *
 * A fresh client per request, never a shared module-level one: caching it
 * would leak one user's session into another user's request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components cannot set cookies. Harmless when a
            // middleware refreshes the session, which is the normal setup.
          }
        },
      },
    },
  );
}
