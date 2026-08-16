import "server-only";

import type { ActivityProvider } from "@/lib/activities/activity";
import { decryptToken, encryptToken } from "@/lib/activities/crypto";
import type { SourceCredentials } from "@/lib/activities/source";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The link between a game account and an activity provider.
 *
 * **Read with the service key, always** — even when reading the
 * participant's own. `activity_connections` has no read policy for anybody,
 * on purpose: row level security filters rows, not columns, so letting
 * somebody read their own row would let them read their own access token
 * straight from the REST API. What the screens get is this module's summary,
 * which has no token in it.
 */

/** Everything a screen may know. Deliberately token-free. */
export type ConnectionSummary = {
  provider: string;
  /** Strava's athlete identifier. Shown so a mislinked account is spottable. */
  providerAccountId: string;
  status: "active" | "broken";
  connectedAt: string;
  lastSyncedAt: string | null;
  scopes: string[];
};

export async function getConnection(
  profileId: string,
  provider: ActivityProvider = "strava",
): Promise<ConnectionSummary | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("activity_connections")
    .select(
      "provider, provider_account_id, status, connected_at, last_synced_at, scopes",
    )
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .is("disconnected_at", null)
    .maybeSingle();

  if (error) {
    console.error("[connexion] lecture impossible", { code: error.code });
    return null;
  }

  if (!data) return null;

  return {
    provider: data.provider,
    providerAccountId: data.provider_account_id,
    status: data.status,
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
    scopes: data.scopes ?? [],
  };
}

/** The signed-in participant's own link, for their screen. */
export async function getOwnConnection(
  provider: ActivityProvider = "strava",
): Promise<ConnectionSummary | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getConnection(user.id, provider);
}

export type LinkOutcome =
  { ok: true } | { ok: false; reason: "taken" | "encryption" | "failed" };

/**
 * Records a freshly authorised link.
 *
 * @returns `taken` when this provider account is already linked to another
 *   game account — the simplest exploit in the whole game, and the one the
 *   database closes rather than the code. Two authorisations arriving at the
 *   same second would both pass any check made here; only the unique index
 *   stops the second one.
 */
export async function linkAccount(
  profileId: string,
  provider: ActivityProvider,
  credentials: SourceCredentials,
): Promise<LinkOutcome> {
  const access = encryptToken(credentials.accessToken);
  const refresh = encryptToken(credentials.refreshToken);

  // No key, no link. Storing a token in clear that everybody downstream
  // assumes is encrypted would be worse than refusing.
  if (!access || !refresh) return { ok: false, reason: "encryption" };

  const admin = createAdminClient();

  // Their own previous link goes first, whatever state it was in (story 3.7
  // AC 5). Without this, reconnecting a broken link hits the one-live-link
  // index and reads as "this account belongs to somebody else" — the most
  // alarming possible message for the most ordinary situation.
  //
  // Only their own: a link held by ANOTHER game account is left standing, and
  // the unique index below still refuses. That refusal is the one that
  // matters, and it is untouched.
  await unlinkAccount(profileId, provider);

  const { error } = await admin.from("activity_connections").insert({
    profile_id: profileId,
    provider,
    provider_account_id: credentials.providerAccountId,
    access_token: access,
    refresh_token: refresh,
    expires_at: credentials.expiresAt,
    scopes: credentials.scopes,
  });

  if (!error) return { ok: true };

  if (error.code === "23505") {
    return { ok: false, reason: "taken" };
  }

  console.error("[connexion] enregistrement impossible", { code: error.code });
  return { ok: false, reason: "failed" };
}

/**
 * Unlinks, without deleting.
 *
 * "This account was connected in November and unlinked in December" stays
 * readable, and the partial unique index stops covering the row — so the
 * provider account is free to be linked again, by its owner or by whoever
 * bought the watch second-hand.
 *
 * Revoking the authorisation at the provider itself is story 3.8: clearing
 * our token alone leaves the participant believing they cut the link when
 * they have not.
 */
export async function unlinkAccount(
  profileId: string,
  provider: ActivityProvider = "strava",
): Promise<boolean> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("activity_connections")
    .update({ disconnected_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .is("disconnected_at", null);

  if (error) {
    console.error("[connexion] déliaison impossible", { code: error.code });
    return false;
  }

  return true;
}

/**
 * The access token, decrypted, for a server-side call to the provider.
 *
 * Never returned to a caller that could send it to a browser: everything
 * that uses this runs in a route handler or a scheduled task.
 *
 * @returns `null` when there is no live link, or when the stored token does
 *   not decrypt — a changed key, an altered row. Both mean the same thing to
 *   the participant: reconnect.
 */
export async function readAccessToken(
  profileId: string,
  provider: ActivityProvider = "strava",
): Promise<{ token: string; expiresAt: string } | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("activity_connections")
    .select("access_token, expires_at")
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .eq("status", "active")
    .is("disconnected_at", null)
    .maybeSingle();

  if (!data) return null;

  const token = decryptToken(data.access_token);
  if (!token) return null;

  return { token, expiresAt: data.expires_at };
}
