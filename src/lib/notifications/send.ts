import "server-only";

import webpush from "web-push";

import { claimDelivery } from "@/lib/notifications/ledger";
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

  const toSend = await claimDelivery(
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

/**
 * One send, to one person's devices, right now (story 6.9).
 *
 * **Deliberately outside the ledger**, which is the only reason it exists.
 * Every ordinary send claims a delivery first, so relaunching it sends
 * nothing — exactly what you want for the daily challenge, and exactly what
 * makes a repair impossible to verify: the second attempt is silently skipped
 * and reads as another failure.
 *
 * Safe to leave outside because nothing else can reach it: administrators
 * only, one recipient, and the recipient is chosen on screen rather than
 * carried by a schedule.
 *
 * Returns what the push service actually answered, per device. The status
 * code is the whole point — 201 means it left, 410 means the phone is gone,
 * 403 means our keys do not match the subscription. Three different repairs
 * behind one "je n'ai rien reçu".
 */
export type TestSendReport = {
  results: { device: string; status: number | null; detail: string }[];
};

export async function sendTestPush(
  profileId: string,
  payload: NotificationPayload,
): Promise<TestSendReport> {
  if (!configure()) {
    return {
      results: [
        {
          device: "—",
          status: null,
          detail: "Clés d’envoi absentes du serveur.",
        },
      ],
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, profile_id, endpoint, p256dh, auth, failure_count, user_agent")
    .eq("profile_id", profileId)
    .is("disabled_at", null);

  if (error) {
    return {
      results: [
        {
          device: "—",
          status: null,
          detail: `Abonnements illisibles (code ${error.code}).`,
        },
      ],
    };
  }

  const devices = (data ?? []) as (Device & { user_agent: string | null })[];

  if (devices.length === 0) {
    return {
      results: [{ device: "—", status: null, detail: "Aucun appareil actif." }],
    };
  }

  const body = JSON.stringify(payload);

  // `allSettled` ici aussi. Le corps ci-dessous rattrape ses propres erreurs,
  // mais `retire()` est appelé *dans* le rattrapage : s'il échouait, le second
  // appareil de quelqu'un qui en a deux ne serait jamais interrogé, et l'écran
  // afficherait une erreur au lieu d'un résultat.
  const outcomes = await Promise.allSettled(
    devices.map(async (device) => {
      const label = describe(device.user_agent);

      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          body,
          { TTL: 60 * 5 },
        );

        await admin
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            failure_count: 0,
          })
          .eq("id", device.id);

        return {
          device: label,
          status: 201,
          detail:
            "Le service de notification a accepté l’envoi. S’il n’apparaît pas sur le téléphone, le problème est sur l’appareil : mode Concentration, notifications de l’application coupées dans les réglages iOS, ou application retirée de l’écran d’accueil.",
        };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        // Traité comme un envoi ordinaire : un appareil réellement mort doit
        // être retiré même quand c'est un test qui le découvre.
        if (isGone(status)) await retire(device.id, status);

        return {
          device: label,
          status: status ?? null,
          detail: explain(status),
        };
      }
    }),
  );

  return {
    results: outcomes.map((outcome, index) =>
      outcome.status === "fulfilled"
        ? outcome.value
        : {
            device: describe(devices[index].user_agent),
            status: null,
            detail:
              "L’envoi s’est interrompu avant d’obtenir une réponse. Réessayez ; si cela se répète, le détail est dans les journaux du serveur.",
          },
    ),
  };
}

/** "iPhone ou iPad", "Android", "ordinateur" — jamais le modèle exact. */
function describe(userAgent: string | null): string {
  if (!userAgent) return "appareil inconnu";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone ou iPad";
  if (/Android/i.test(userAgent)) return "Android";

  return "ordinateur";
}

function explain(status: number | undefined): string {
  if (status === 404 || status === 410)
    return "L’adresse de cet appareil n’existe plus : application désinstallée, navigateur effacé, ou abonnement remplacé. L’appareil vient d’être retiré — il suffit de réactiver les notifications depuis le téléphone.";

  if (status === 403 || status === 401)
    return "Le service refuse notre signature. Les clés VAPID du serveur ne sont plus celles avec lesquelles cet abonnement a été créé : après un changement de clés, chaque participant doit réactiver ses notifications.";

  if (status === 413)
    return "Le message est trop volumineux pour le service de notification.";

  if (status === 429)
    return "Le service demande de ralentir. Réessayer dans quelques minutes.";

  if (status === undefined)
    return "La requête n’est jamais partie : le serveur ne joint pas le service de notification.";

  return `Le service de notification répond ${status}.`;
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
