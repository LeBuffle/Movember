import "server-only";

import webpush from "web-push";

import type {
  NotificationCategory,
  NotificationPayload,
} from "@/lib/notifications/payload";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sending a notification to a lot of people at once.
 *
 * **The only operation in the project that touches 800 recipients in one
 * go**, and the one the architecture names as the bottleneck of 1 November —
 * ahead of the web server (architecture §10).
 *
 * Three things decide whether this works in November, and none of them are
 * about speed:
 *
 * 1. **A send must be replayable.** A cron that overlaps, a task relaunched
 *    by hand because the morning looked wrong — for a database write that is
 *    harmless, for a notification it is not. The row is written *before* the
 *    send, and a unique violation is read as "already done".
 * 2. **A dead endpoint has to be retired.** A participant uninstalls, changes
 *    phone, wipes their browser. Never retiring them makes the failure rate
 *    climb month after month until it hides the real outages.
 * 3. **Definitive and temporary failures are not the same thing.** Retiring
 *    a subscription on a passing network error would cut off a participant in
 *    perfect health, silently.
 */

/**
 * Fifty at a time.
 *
 * Small enough that a slow batch does not hold the rest for minutes, large
 * enough that 800 recipients take sixteen rounds rather than eight hundred.
 * The push services accept far more; what this really bounds is the number of
 * sockets open at once on a modest VPS.
 */
const BATCH_SIZE = 50;

/**
 * How many consecutive failures before an endpoint is retired.
 *
 * Only for failures that are not already definitive — those are retired at
 * once. This covers an endpoint that answers, but never successfully.
 */
const MAX_FAILURES = 5;

export type SendReport = {
  /** Notifications handed to a push service. */
  sent: number;
  /** Endpoints that answered with an error we will retry. */
  failed: number;
  /** Endpoints retired for good. */
  disabled: number;
  /** Participants deliberately not sent to — already done, or no device. */
  skipped: number;
};

const EMPTY: SendReport = { sent: 0, failed: 0, disabled: 0, skipped: 0 };

export type SendRequest = {
  profileIds: string[];
  payload: NotificationPayload;
  category: NotificationCategory;
  /**
   * What makes this send unique — `defi-du-jour:2026-11-03`, `annonce:<id>`.
   * Relaunching the same task with the same key sends nothing.
   */
  dedupeKey: string;
};

/** Whether the keys needed to sign a send are present. */
export function pushSendConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

function configure(): boolean {
  if (!pushSendConfigured()) return false;

  webpush.setVapidDetails(
    // A way for a push service to reach us if our sends misbehave. Falling
    // back to a placeholder rather than refusing: a missing contact address
    // is not a reason to stop notifying 800 people.
    process.env.VAPID_SUBJECT?.trim() || "mailto:contact@defi-movember.fr",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );

  return true;
}

type Device = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

/**
 * Claims the send for a list of participants, and returns those still to do.
 *
 * **The row is written before anything goes out.** Two overlapping runs both
 * read "not yet sent" and both send; only a unique index refuses. A conflict
 * therefore means somebody else got there first, and is not an error.
 */
async function claim(
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

/**
 * Sends one payload to every live device of the given participants.
 *
 * The caller decides *who* — preferences (story 6.7) and the e-mail fallback
 * (story 6.4) are applied before this is reached. This function only knows
 * how to deliver.
 */
export async function sendPush(request: SendRequest): Promise<SendReport> {
  if (request.profileIds.length === 0) return EMPTY;

  if (!configure()) {
    console.error("[notifications] clés VAPID absentes : aucun envoi");
    return { ...EMPTY, skipped: request.profileIds.length };
  }

  const toSend = await claim(
    request.profileIds,
    request.dedupeKey,
    request.category,
    "push",
  );

  const alreadyDone = request.profileIds.length - toSend.length;
  if (toSend.length === 0) return { ...EMPTY, skipped: alreadyDone };

  const admin = createAdminClient();

  const { data: devices, error } = await admin
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth, failure_count")
    .in("profile_id", toSend)
    .is("disabled_at", null);

  if (error) {
    console.error("[notifications] abonnements illisibles", {
      code: error.code,
    });
    return { ...EMPTY, skipped: request.profileIds.length };
  }

  const list = (devices ?? []) as Device[];
  const body = JSON.stringify(request.payload);

  const report: SendReport = {
    ...EMPTY,
    // Claimed, but with no device to send to. Counted apart from a failure:
    // one is a participant who never allowed notifications, the other is a
    // notification that did not arrive.
    skipped: alreadyDone + countWithoutDevice(toSend, list),
  };

  for (let start = 0; start < list.length; start += BATCH_SIZE) {
    const batch = list.slice(start, start + BATCH_SIZE);

    // `allSettled`, never `all`: one rejected send must not abandon the other
    // forty-nine, and on the morning of 1 November there will be rejected
    // sends.
    const outcomes = await Promise.allSettled(
      batch.map((device) => deliver(device, body)),
    );

    for (const outcome of outcomes) {
      if (outcome.status !== "fulfilled") {
        report.failed += 1;
        continue;
      }

      report[outcome.value] += 1;
    }
  }

  return report;
}

function countWithoutDevice(profileIds: string[], devices: Device[]): number {
  const reachable = new Set(devices.map((device) => device.profile_id));

  return profileIds.filter((id) => !reachable.has(id)).length;
}

type Outcome = "sent" | "failed" | "disabled";

async function deliver(device: Device, body: string): Promise<Outcome> {
  const admin = createAdminClient();

  try {
    await webpush.sendNotification(
      {
        endpoint: device.endpoint,
        keys: { p256dh: device.p256dh, auth: device.auth },
      },
      body,
      // Twelve hours. A challenge reminder that arrives the next morning is
      // noise; one that waits for a phone switched back on at lunchtime is
      // still useful.
      { TTL: 60 * 60 * 12 },
    );

    await admin
      .from("push_subscriptions")
      .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
      .eq("id", device.id);

    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;

    if (isGone(status)) {
      await retire(device.id, status);
      return "disabled";
    }

    const failures = device.failure_count + 1;

    await admin
      .from("push_subscriptions")
      .update({
        failure_count: failures,
        ...(failures >= MAX_FAILURES
          ? { disabled_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", device.id);

    return failures >= MAX_FAILURES ? "disabled" : "failed";
  }
}

/**
 * Definitively gone, as opposed to temporarily unhappy.
 *
 * **This distinction is the heart of the story.** 404 and 410 are the push
 * services saying "this endpoint does not exist any more" — an uninstall, a
 * wiped browser, a rotated subscription. Everything else, including 429 and
 * every 5xx, is "not now": retiring on those would cut off a participant in
 * perfect health, silently, on a passing network error.
 */
function isGone(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

async function retire(id: string, status: number | undefined): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from("push_subscriptions")
    .update({ disabled_at: new Date().toISOString() })
    .eq("id", id);

  console.info("[notifications] abonnement retiré", { status });
}
