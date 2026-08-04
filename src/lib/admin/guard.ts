import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Establishes that the caller is an administrator, or refuses.
 *
 * There are three layers of protection on `/admin`, and this is the one that
 * decides:
 *
 * 1. The middleware rewrites the request for a non-admin. Fast, but it is a
 *    routing rule — a change to its matcher would silently disable it.
 * 2. **This function**, called by the admin layout and by every server
 *    action that touches administrative data. Reads the role from the
 *    database on the server, per request.
 * 3. Row level security, which refuses the query itself even if the two
 *    above were bypassed.
 *
 * Hiding a link in a menu is not one of the layers (`CLAUDE.md`,
 * architecture §8.1). Neither is a check in a client component: whatever a
 * browser can decide, a browser can be made to decide differently.
 *
 * `getUser()` rather than `getSession()`: it revalidates the token against
 * Supabase instead of trusting a cookie the client could forge.
 */
export type AdminIdentity = {
  id: string;
  displayName: string;
};

export async function requireAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;

  return { id: user.id, displayName: profile.display_name };
}
