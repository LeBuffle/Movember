import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recomputing the rankings.
 *
 * Called by the scheduled task every fifteen minutes. **Nothing computes a
 * ranking on demand**, anywhere in the application — that is the whole point
 * of the materialised view, and the reason eight rankings cost the same as
 * one.
 *
 * The refresh runs `concurrently`, so the rankings stay readable while they
 * are being rebuilt (story 7.3 AC 5). A refresh that blanked the leaderboard
 * for a few seconds, four times an hour, would be noticed by somebody every
 * single time.
 */

export type RefreshReport = {
  /** False when another refresh was already running — not a failure. */
  refreshed: boolean;
  failed: boolean;
};

export async function refreshLeaderboards(): Promise<RefreshReport> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("refresh_leaderboards");

  if (error) {
    console.error("[classements] rafraîchissement impossible", {
      code: error.code,
      message: error.message,
    });
    return { refreshed: false, failed: true };
  }

  if (!data) {
    // Another run holds the lock. Normal, and not worth an alert: the next
    // pass in fifteen minutes will find it free.
    console.info(
      "[classements] rafraîchissement déjà en cours, passe suivante",
    );
  }

  return { refreshed: Boolean(data), failed: false };
}
