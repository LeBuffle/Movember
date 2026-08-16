import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Supabase client with no session at all.
 *
 * The third of the three, and the one with the narrowest job. `server.ts`
 * acts as the signed-in participant; `admin.ts` bypasses every policy for
 * webhooks and scheduled tasks; this one reads what is public, as `anon`, and
 * **reads no cookie**.
 *
 * That last point is the whole reason it exists. A page that reads a cookie
 * can never be cached — Next has to assume the response is personal. The
 * public pages (home, card gallery) show the same thing to everybody, so they
 * are regenerated on a timer and served from cache to the thousand visitors a
 * share brings. Using the session client on them would turn every visit into
 * a database round trip, on the pages most likely to be opened on a phone,
 * on a poor connection.
 *
 * Still fully bound by row level security: it can read published cards and
 * the tier list, and nothing else.
 *
 * @returns `null` when the environment is not configured, so a caller can
 *   degrade rather than crash a public page.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
