import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Storing what a browser handed us when it agreed to be notified.
 *
 * **Written with the service key, and that needs saying.**
 * `push_subscriptions` carries no write policy for anybody, because
 * `failure_count`, `last_success_at` and `disabled_at` are the sender's
 * bookkeeping — the mechanism that retires a dead endpoint (story 6.3). Row
 * level security filters rows, not columns, so a policy letting a
 * participant write their own row would let them reset that bookkeeping too.
 *
 * The identity check therefore happens here, and is carried by the write:
 * `profile_id` comes from the session and is never a parameter.
 */

export type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

export type OwnSubscription = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSuccessAt: string | null;
};

/**
 * @returns `false` when nothing was stored, so the screen can say the
 *   notification will not arrive rather than claim it will.
 */
export async function saveSubscription(
  input: SubscriptionInput,
): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const admin = createAdminClient();

  // Upserted on the endpoint rather than inserted.
  //
  // A browser hands back an endpoint it already gave whenever the page asks
  // again — reopening the app, re-granting permission, a rotation by the push
  // service. Inserting would either fail or, worse, duplicate: the
  // participant would then receive every notification twice, and read that as
  // a bug in the game rather than in their browser.
  //
  // The endpoint may also change hands: somebody signing in on a phone
  // another participant used. `profile_id` is therefore part of what gets
  // written, and the row follows the person who last allowed it.
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 400) ?? null,
      // A subscription offered again is alive again, whatever the sender
      // concluded about it before.
      failure_count: 0,
      disabled_at: null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[notifications] abonnement non enregistré", {
      code: error.code,
    });
    return false;
  }

  return true;
}

/**
 * Forgetting a device.
 *
 * Deleted rather than disabled, unlike what the sender does with a dead
 * endpoint. This one is a decision by the participant, and keeping a record
 * of a subscription somebody asked to remove would be keeping personal data
 * without a purpose.
 */
export async function removeSubscription(endpoint: string): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const admin = createAdminClient();

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    // The guard carried by the write: an endpoint belonging to somebody else
    // is not removed, whatever was posted.
    .eq("profile_id", user.id);

  if (error) {
    console.error("[notifications] abonnement non supprimé", {
      code: error.code,
    });
    return false;
  }

  return true;
}

/** The participant's own devices, read through their own session. */
export async function ownSubscriptions(): Promise<OwnSubscription[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, user_agent, created_at, last_success_at")
    .is("disabled_at", null)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSuccessAt: row.last_success_at,
  }));
}
