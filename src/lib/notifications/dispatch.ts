import "server-only";

import {
  sendFallbackEmails,
  type EmailReport,
} from "@/lib/notifications/email-fallback";
import { claimDelivery } from "@/lib/notifications/ledger";
import {
  ESSENTIAL_CATEGORIES,
  type NotificationCategory,
  type NotificationPayload,
} from "@/lib/notifications/payload";
import {
  channelFor,
  preferencesFor,
  type Channel,
} from "@/lib/notifications/preferences";
import { sendPush, type SendReport } from "@/lib/notifications/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one door every notification goes through.
 *
 * **That is the whole reason this file exists.** Story 6.7 promises that a
 * preference is honoured by every send — the daily task, the validation
 * message, a manual send from the back-office. A promise like that cannot be
 * kept by asking each caller to remember: the route that forgets is always
 * the one added in a hurry, in November. So callers say *who* and *what*, and
 * never *how*, and there is a single place where a preference can be applied
 * or missed.
 *
 * What it decides, per participant:
 *
 * - the category is switched off → nothing, recorded as `none`
 * - they have a device and accept push → push
 * - otherwise, if the category is essential and they accept e-mail → e-mail
 * - otherwise → nothing
 *
 * **Never both channels for the same person** (story 6.4 AC 3). A duplicate
 * is not twice the attention, it is a defect people write in about.
 */

export type DispatchRequest = {
  profileIds: string[];
  category: NotificationCategory;
  payload: NotificationPayload;
  /** Makes the send unique. Relaunching with the same key sends nothing. */
  dedupeKey: string;
};

export type DispatchReport = SendReport & {
  /** Participants routed to e-mail rather than push. */
  emailed: number;
};

const EMPTY: DispatchReport = {
  sent: 0,
  failed: 0,
  disabled: 0,
  skipped: 0,
  emailed: 0,
};

/** Who currently has at least one live device. */
async function withDevices(profileIds: string[]): Promise<Set<string>> {
  if (profileIds.length === 0) return new Set();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("profile_id")
    .in("profile_id", profileIds)
    .is("disabled_at", null);

  if (error) {
    console.error("[notifications] appareils illisibles", {
      code: error.code,
    });
    // Nobody has a device, so the essential categories fall back to e-mail.
    // Degrading towards the slower channel beats degrading towards silence.
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.profile_id));
}

export async function notify(
  request: DispatchRequest,
): Promise<DispatchReport> {
  if (request.profileIds.length === 0) return EMPTY;

  const essential = ESSENTIAL_CATEGORIES.includes(request.category);

  const [preferences, devices] = await Promise.all([
    preferencesFor(request.profileIds),
    withDevices(request.profileIds),
  ]);

  const byChannel: Record<Channel, string[]> = {
    push: [],
    email: [],
    none: [],
  };

  for (const profileId of request.profileIds) {
    const channel = channelFor(preferences.get(profileId)!, request.category, {
      hasDevice: devices.has(profileId),
      essential,
    });

    byChannel[channel].push(profileId);
  }

  // The two channels run side by side. They touch different participants —
  // nobody is in both lists — so there is nothing to serialise, and a slow
  // e-mail provider must not hold back the push that reaches the phone people
  // are actually looking at.
  const [pushed, mailed] = await Promise.all([
    sendPush({
      profileIds: byChannel.push,
      payload: request.payload,
      category: request.category,
      dedupeKey: request.dedupeKey,
    }),
    sendEmails(byChannel.email, request),
  ]);

  return {
    ...pushed,
    skipped: pushed.skipped + mailed.skipped + byChannel.none.length,
    failed: pushed.failed + mailed.failed,
    emailed: mailed.sent,
  };
}

/**
 * The e-mail branch, claimed in the same ledger as the push one.
 *
 * The claim is what makes a relaunched task harmless, and it has to happen
 * here too: an e-mail sent twice is worse than a push sent twice, because it
 * sits in an inbox until somebody deletes it.
 */
async function sendEmails(
  profileIds: string[],
  request: DispatchRequest,
): Promise<EmailReport> {
  if (profileIds.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const toSend = await claimDelivery(
    profileIds,
    request.dedupeKey,
    request.category,
    "email",
  );

  const alreadyDone = profileIds.length - toSend.length;
  const report = await sendFallbackEmails(
    toSend,
    request.payload,
    request.category,
  );

  return { ...report, skipped: report.skipped + alreadyDone };
}
