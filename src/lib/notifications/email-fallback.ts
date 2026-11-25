import "server-only";

import { sendEmail } from "@/lib/email/client";
import { notificationEmail } from "@/lib/email/templates";
import type {
  NotificationCategory,
  NotificationPayload,
} from "@/lib/notifications/payload";
import { signUnsubscribe } from "@/lib/notifications/unsubscribe";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The e-mail side of a send.
 *
 * **A first-class channel, not a patch** (PRD §4). It covers everybody who
 * will not install the application — and on iPhone, that will be a lot of
 * people. Treating it as a fallback in the pejorative sense would mean
 * treating those participants as second-class, which is exactly the outcome
 * the epic exists to avoid.
 *
 * It carries only the essential categories (architecture D6). That is decided
 * upstream, in `preferences.ts`; this file only knows how to deliver.
 *
 * Written to be safe to replay: the caller has already claimed the send in
 * `notification_deliveries` before reaching here, so a relaunched task finds
 * nothing left to do.
 */

export type EmailReport = {
  sent: number;
  failed: number;
  /** No address on file, or the service is not configured. */
  skipped: number;
};

const EMPTY: EmailReport = { sent: 0, failed: 0, skipped: 0 };

/**
 * Twenty at a time.
 *
 * Lower than the push batch on purpose: an e-mail provider rate-limits, and a
 * burst of eight hundred is exactly what gets a young sending domain
 * throttled — or worse, reputationally marked.
 */
const BATCH_SIZE = 20;

export async function sendFallbackEmails(
  profileIds: string[],
  payload: NotificationPayload,
  _category: NotificationCategory,
): Promise<EmailReport> {
  if (profileIds.length === 0) return EMPTY;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", profileIds)
    .is("deleted_at", null);

  if (error) {
    console.error("[e-mail] destinataires illisibles", { code: error.code });
    return { ...EMPTY, skipped: profileIds.length };
  }

  const recipients = (data ?? []).filter((row) => Boolean(row.email));
  const report: EmailReport = {
    ...EMPTY,
    skipped: profileIds.length - recipients.length,
  };

  const actionUrl = absoluteUrl(payload.url);

  for (let start = 0; start < recipients.length; start += BATCH_SIZE) {
    const batch = recipients.slice(start, start + BATCH_SIZE);

    const outcomes = await Promise.allSettled(
      batch.map(async (recipient) => {
        const token = signUnsubscribe(recipient.id);

        const unsubscribeUrl = token
          ? absoluteUrl(`/desabonnement?jeton=${encodeURIComponent(token)}`)
          : undefined;

        const content = notificationEmail({
          payload,
          actionUrl,
          unsubscribeUrl,
        });

        return sendEmail({
          to: recipient.email!,
          subject: content.subject,
          html: content.html,
          text: content.text,
          unsubscribeUrl,
        });
      }),
    );

    for (const outcome of outcomes) {
      if (outcome.status !== "fulfilled") {
        report.failed += 1;
        continue;
      }

      if (outcome.value.ok) report.sent += 1;
      // Not configured is not a failure of the send: it is the normal state
      // until the account exists, and counting it as failed would make the
      // report look alarming for months.
      else if (outcome.value.reason === "unconfigured") report.skipped += 1;
      else report.failed += 1;
    }
  }

  return report;
}
