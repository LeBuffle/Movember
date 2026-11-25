import "server-only";

import type { ActivityProvider } from "@/lib/activities/activity";
import { decryptToken, encryptToken } from "@/lib/activities/crypto";
import { activitySource } from "@/lib/activities/sources";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keeping a link alive for thirty days.
 *
 * A Strava access token expires in a few hours. Without this, a link made
 * this evening stops working tomorrow morning — and the participant finds
 * out by losing a challenge, three days later, which is the worst possible
 * way to learn it.
 *
 * **Refreshed before expiry, never after a failed call.** Waiting for the
 * first error means losing that call, and the call in question is usually
 * the handling of a webhook — so the activity never arrives at all, and
 * nothing says why.
 */

/**
 * How long before expiry a token is considered due.
 *
 * Wider than the hourly task's interval on purpose: a token expiring in
 * fifty minutes must be caught by *this* run, not by the next one, or it
 * dies in the gap between the two.
 */
const RENEW_WITHIN_MS = 90 * 60 * 1000;

/** After this, a claim is assumed abandoned rather than in flight. */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

/** A run's worth. Well above four hundred participants in one provider. */
const MAX_PER_RUN = 500;

export type RefreshOutcome =
  /** Refreshed, or still valid — either way there is a usable token. */
  | { ok: true; token: string }
  /** The participant revoked us. Nothing to retry, ever. */
  | { ok: false; reason: "broken" }
  /** Somebody else is refreshing, or the provider is unreachable. */
  | { ok: false; reason: "busy" | "unavailable" | "missing" };

type ConnectionRow = {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  status: "active" | "broken";
};

/**
 * A usable access token for this participant, refreshing it if it is due.
 *
 * The one function everything else calls. Story 3.5's webhook and story
 * 3.6's catch-up both go through it, so neither has to remember that tokens
 * expire.
 */
export async function validAccessToken(
  profileId: string,
  provider: ActivityProvider = "strava",
): Promise<RefreshOutcome> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("activity_connections")
    .select("id, access_token, refresh_token, expires_at, status")
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .is("disconnected_at", null)
    .maybeSingle();

  if (!data) return { ok: false, reason: "missing" };

  const row = data as ConnectionRow;

  if (row.status === "broken") return { ok: false, reason: "broken" };

  if (!isDue(row.expires_at)) {
    const token = decryptToken(row.access_token);

    // A token that will not decrypt is a link the participant has to make
    // again — a changed key, an altered row. Saying "broken" is the honest
    // answer; pretending it is a provider outage would keep them waiting.
    return token
      ? { ok: true, token }
      : await markBroken(row.id, "chiffrement illisible");
  }

  return refreshOne(row, provider);
}

function isDue(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() - Date.now() <= RENEW_WITHIN_MS;
}

/**
 * Refreshes one link, once.
 *
 * The claim is taken **before** the provider is called, and the write that
 * takes it is what serialises two callers. Checking a column and then
 * writing it would not: the hourly task and a webhook can read the same row
 * in the same millisecond.
 */
async function refreshOne(
  row: ConnectionRow,
  provider: ActivityProvider,
): Promise<RefreshOutcome> {
  const admin = createAdminClient();
  const now = new Date();
  const stale = new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString();

  const { data: claimed } = await admin
    .from("activity_connections")
    .update({ refreshing_at: now.toISOString() })
    .eq("id", row.id)
    // Free, or claimed so long ago that the claimant is plainly gone.
    .or(`refreshing_at.is.null,refreshing_at.lt.${stale}`)
    .select("id");

  if ((claimed ?? []).length === 0) {
    // Somebody else has it. Their result lands in a moment; ours would only
    // race it, and Strava rotates the refresh token so the loser breaks the
    // link. Backing off is the whole point.
    return { ok: false, reason: "busy" };
  }

  const source = activitySource(provider);
  const refreshToken = decryptToken(row.refresh_token);

  if (!source || !refreshToken) {
    await release(row.id);
    return markBroken(row.id, "jeton de rafraîchissement illisible");
  }

  const refreshed = await source.refresh(refreshToken);

  if (!refreshed.ok) {
    await release(row.id);

    if (refreshed.reason === "denied") {
      // The participant revoked us from their Strava settings. They are
      // within their rights, and knocking again would burn the application's
      // call quota for everybody without ever succeeding.
      return markBroken(row.id, "autorisation révoquée");
    }

    return { ok: false, reason: "unavailable" };
  }

  const access = encryptToken(refreshed.value.accessToken);
  const nextRefresh = encryptToken(refreshed.value.refreshToken);

  if (!access || !nextRefresh) {
    await release(row.id);
    return { ok: false, reason: "unavailable" };
  }

  const { error } = await admin
    .from("activity_connections")
    .update({
      access_token: access,
      refresh_token: nextRefresh,
      expires_at: refreshed.value.expiresAt,
      refreshing_at: null,
    })
    .eq("id", row.id);

  if (error) {
    console.error("[jetons] enregistrement impossible", { code: error.code });
    await release(row.id);
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, token: refreshed.value.accessToken };
}

async function release(id: string): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from("activity_connections")
    .update({ refreshing_at: null })
    .eq("id", id);
}

/**
 * Marks a link as broken, and stops.
 *
 * The reason is logged, never stored: a column holding "autorisation
 * révoquée" would be one more thing to keep in step with `status`, and the
 * participant is told the same thing whatever the cause — reconnect.
 */
async function markBroken(id: string, why: string): Promise<RefreshOutcome> {
  const admin = createAdminClient();

  console.error("[jetons] liaison rompue", { connection: id, why });

  await admin
    .from("activity_connections")
    .update({
      status: "broken",
      broken_at: new Date().toISOString(),
      refreshing_at: null,
    })
    .eq("id", id);

  return { ok: false, reason: "broken" };
}

export type RefreshReport = {
  examined: number;
  refreshed: number;
  broken: number;
  skipped: number;
};

/**
 * The hourly sweep: every link whose token is about to expire.
 *
 * Runs ahead of need rather than on demand, which is what makes the webhook
 * of story 3.5 fast — by the time an activity arrives, the token is already
 * good.
 */
export async function refreshExpiringConnections(
  provider: ActivityProvider = "strava",
): Promise<RefreshReport> {
  const admin = createAdminClient();
  const report: RefreshReport = {
    examined: 0,
    refreshed: 0,
    broken: 0,
    skipped: 0,
  };

  const due = new Date(Date.now() + RENEW_WITHIN_MS).toISOString();

  const { data, error } = await admin
    .from("activity_connections")
    .select("id, access_token, refresh_token, expires_at, status")
    .eq("provider", provider)
    .eq("status", "active")
    .is("disconnected_at", null)
    .lte("expires_at", due)
    .order("expires_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[jetons] liaisons illisibles", { code: error.code });
    return report;
  }

  const rows = (data ?? []) as ConnectionRow[];
  report.examined = rows.length;

  for (const row of rows) {
    const outcome = await refreshOne(row, provider);

    if (outcome.ok) report.refreshed += 1;
    else if (outcome.reason === "broken") report.broken += 1;
    else report.skipped += 1;
  }

  return report;
}
