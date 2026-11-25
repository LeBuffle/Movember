import "server-only";

import type { NotificationCategory } from "@/lib/notifications/payload";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The record of what has already gone out.
 *
 * **Claimed before anything is sent, never after.** Everything scheduled in
 * this project can run twice: a cron that overlaps, a task relaunched by hand
 * because the morning looked wrong, a deployment mid-run. For a database
 * write that is harmless. For a notification it is not — one that is sent is
 * sent, and an e-mail sits in an inbox until somebody deletes it.
 *
 * Two overlapping runs both read "not yet sent" and both send; only a unique
 * index refuses. So the row is written first, and a conflict is read as
 * "somebody else got there first" rather than as an error.
 *
 * Shared by both channels, which is what guarantees a participant cannot
 * receive the same message once by push and once by e-mail through two
 * different code paths.
 */
export async function claimDelivery(
  profileIds: string[],
  dedupeKey: string,
  category: NotificationCategory,
  channel: "push" | "email" | "none",
): Promise<string[]> {
  if (profileIds.length === 0) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notification_deliveries")
    .upsert(
      profileIds.map((profileId) => ({
        profile_id: profileId,
        dedupe_key: dedupeKey,
        category,
        channel,
      })),
      { onConflict: "profile_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("profile_id");

  if (error) {
    console.error("[notifications] réservation impossible", {
      code: error.code,
    });
    // Nothing is sent rather than everything sent twice. A missed
    // notification is a disappointment; a duplicated one is a defect people
    // write in about.
    return [];
  }

  return (data ?? []).map((row) => row.profile_id);
}
