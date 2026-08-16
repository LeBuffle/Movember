import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Supabase client for the browser.
 *
 * Uses the anonymous key, which is public by design: it grants nothing on its
 * own. Every read and write it performs is filtered by the row level security
 * policies, so a compromised page can still only reach the signed-in user's
 * own rows.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
