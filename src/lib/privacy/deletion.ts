import "server-only";

import { readAccessToken, unlinkAccount } from "@/lib/activities/connection";
import { activitySource } from "@/lib/activities/sources";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Erasing an account, for real (story 11.2).
 *
 * **The database does almost all of it.** Everything personal hangs off
 * `profiles` with `on delete cascade` — activities, the sporting link, the
 * consents, the address, the cards, the challenges, the push subscriptions,
 * the team membership. Deleting the auth user removes the profile, and the
 * cascade removes the rest. Writing an application that deleted fifteen
 * tables in order would have been fifteen chances to forget one, and the one
 * forgotten would have been the health data.
 *
 * **Two things survive, and both are deliberate.**
 *
 * 1. **The accounting lines.** `payments.profile_id` is `on delete set null`:
 *    the amount and the date remain, the link to the person is broken. The
 *    association hands money to a foundation and has to justify it — the
 *    obligation to keep the record outlives the account, which is why the
 *    privacy policy says so in as many words.
 * 2. **The back-office audit log.** An administrator cannot erase their own
 *    account from here: `admin_audit_log.admin_id` is `on delete restrict`,
 *    on purpose. A log whose author can remove themselves is not a log.
 *
 * **Strava is revoked before anything is deleted.** Clearing our token alone
 * would leave the participant believing they cut the link when they have not
 * — and once the profile is gone we no longer hold the token to revoke it
 * with. This is the one ordering in the whole file that cannot be changed.
 */

export type DeletionOutcome =
  | { ok: true; stravaRevoked: boolean }
  | {
      ok: false;
      reason:
        /** An administrator: the audit log must keep its author. */
        | "is-admin"
        /** Strava did not answer. Nothing was deleted; try again. */
        | "provider-unavailable"
        | "failed";
    };

export async function deleteAccount(
  profileId: string,
): Promise<DeletionOutcome> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role, display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    // Already gone. Reported as done: the caller's goal is satisfied, and an
    // error here would send somebody chasing a deletion that happened.
    return { ok: true, stravaRevoked: false };
  }

  if (profile.role === "admin") {
    return { ok: false, reason: "is-admin" };
  }

  /* Strava first, and its failure stops everything. Deleting our side while
     the authorisation stays live at Strava is the single outcome this must
     never produce: the participant is told their data is gone and Strava
     keeps answering for them. */
  let stravaRevoked = false;
  const source = activitySource("strava");
  const stored = await readAccessToken(profileId);

  if (source && stored) {
    const revoked = await source.revoke(stored.token);

    if (!revoked.ok && revoked.reason === "unavailable") {
      return { ok: false, reason: "provider-unavailable" };
    }

    stravaRevoked = revoked.ok;
  }

  // Our own row, so nothing keeps syncing between here and the deletion.
  await unlinkAccount(profileId);

  /* The pseudonym is neutralised and the profile marked deleted *before* the
     auth user is removed. If the call below then failed — a network blip
     against the auth service — the participant is already invisible
     everywhere: every screen and the leaderboard filter on `deleted_at`. The
     next attempt finishes the job. Doing it the other way round would leave
     a live, named profile behind a failed deletion. */
  const { error: markError } = await admin
    .from("profiles")
    .update({
      display_name: "Compte supprimé",
      email: null,
      avatar_url: null,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .is("deleted_at", null);

  if (markError) {
    console.error("[effacement] profil non neutralisé", {
      code: markError.code,
    });
    return { ok: false, reason: "failed" };
  }

  // And now the cascade. Deleting the auth user is what removes the profile,
  // and the profile is what everything personal hangs from.
  const { error } = await admin.auth.admin.deleteUser(profileId);

  if (error) {
    // The profile is already neutralised, so nothing identifies anybody. The
    // line below is what a human acts on to finish it.
    console.error("[effacement] utilisateur non supprimé, profil neutralisé", {
      profile: profileId,
      message: error.message,
    });
    return { ok: false, reason: "failed" };
  }

  console.info("[effacement] compte supprimé", {
    profile: profileId,
    stravaRevoked,
  });

  return { ok: true, stravaRevoked };
}
