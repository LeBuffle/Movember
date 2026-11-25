// This import is the guard, and it is the whole point of this line being
// first. `server-only` makes the build fail — loudly, at compile time — if
// this module is ever pulled into a client component. Without it, the
// service role key would be bundled into JavaScript sent to browsers.
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Supabase client holding the service role key.
 *
 * ⚠️ This client **bypasses every row level security policy**. It can read
 * and write any row belonging to any participant. It exists for the few
 * operations that legitimately act outside a user session:
 *
 *   - Stripe webhooks activating a registration (epic 2)
 *   - Strava webhooks storing incoming activities (epic 3)
 *   - Scheduled tasks assigning daily challenges (epic 4)
 *
 * Anything happening on behalf of a signed-in user must use `server.ts`
 * instead, so the database keeps enforcing the rules rather than trusting
 * the code to get them right.
 *
 * Rule of thumb: reaching for this client is a decision that deserves a
 * comment explaining why the user-scoped one will not do.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    // Fails immediately rather than returning a client that misbehaves in
    // confusing ways later — a webhook silently writing nothing is far
    // harder to diagnose than a startup error.
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      // No session to persist or refresh: this client is not a user.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
