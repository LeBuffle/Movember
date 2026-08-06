import "server-only";

import type { Audience } from "@/lib/notifications/audience";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who a manual send reaches.
 *
 * **The count comes before the send, and that is the real safeguard** (story
 * 6.8 AC 2). A message meant for a handful of people and sent to eight
 * hundred cannot be taken back — a notification that has gone has gone. A
 * number on screen, read a second before pressing, is worth more than any
 * confirmation dialogue.
 *
 * Only active registrations. Somebody who abandoned mid-payment, or was
 * refunded, is not a participant and must not be notified as one.
 */

/**
 * @returns the profile identifiers, not a count. The screen counts them, the
 *   send uses them — reading twice would let the two disagree between the
 *   moment somebody reads the number and the moment they press.
 */
export async function audienceMembers(audience: Audience): Promise<string[]> {
  const admin = createAdminClient();

  const { data: edition } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data, error } = await admin
    .from("registrations")
    .select("profile_id")
    .eq("edition_id", edition.id)
    .eq("status", "active");

  if (error) {
    console.error("[notifications] audience illisible", { code: error.code });
    return [];
  }

  const everybody = (data ?? []).map((row) => row.profile_id);
  if (audience === "tous") return everybody;

  const { data: devices } = await admin
    .from("push_subscriptions")
    .select("profile_id")
    .in("profile_id", everybody)
    .is("disabled_at", null);

  const reachable = new Set((devices ?? []).map((row) => row.profile_id));

  return audience === "avec-notifications"
    ? everybody.filter((id) => reachable.has(id))
    : everybody.filter((id) => !reachable.has(id));
}
