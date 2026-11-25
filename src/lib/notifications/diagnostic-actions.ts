"use server";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import {
  diagnoseNotifications,
  type NotificationDiagnostic,
} from "@/lib/notifications/diagnostic";
import { buildPayload } from "@/lib/notifications/payload";
import { sendTestPush } from "@/lib/notifications/send";

/**
 * The notification diagnostic and its test send, behind the admin guard
 * (story 6.9).
 *
 * Both run on **the administrator's own account** by default, like the Strava
 * pair: the screen exists to answer "why does mine not arrive", and diagnosing
 * somebody else's from there would mean an identifier in a form on a screen
 * that has no business taking one. The participant-record versions below are
 * the November tool, and the one that writes is journalised.
 */

export type NotificationDiagnosticState = {
  report?: NotificationDiagnostic;
  message?: string;
};

export async function diagnoseNotificationsAction(
  _previous: NotificationDiagnosticState,
  _formData: FormData,
): Promise<NotificationDiagnosticState> {
  const admin = await requireAdmin();

  if (!admin) return { message: "Cette page n’est plus accessible." };

  return { report: await diagnoseNotifications(admin.id) };
}

export type TestSendState = { message?: string; lines?: string[] };

/**
 * One notification, to my own phone, now.
 *
 * **The only step that interrogates the push service itself.** Everything
 * above it can be green while the service refuses our signature or answers
 * that the phone is gone — and those two answers demand opposite repairs.
 *
 * It carries the same wording every time on purpose: a test whose text
 * changes is a test somebody mistakes for a real message.
 */
export async function sendTestNotificationAction(
  _previous: TestSendState,
  _formData: FormData,
): Promise<TestSendState> {
  const admin = await requireAdmin();

  if (!admin) return { message: "Cette page n’est plus accessible." };

  const report = await sendTestPush(
    admin.id,
    buildPayload({
      title: "Test — DEFI Movember",
      body: "Si vous lisez ceci sur votre téléphone, les notifications fonctionnent.",
      url: "/jeu",
      tag: "test",
    }),
  );

  return {
    lines: report.results.map(
      (result) =>
        `${result.device} — ${result.status ?? "aucune réponse"} : ${result.detail}`,
    ),
  };
}

/* -------------------------------------------------------------------------
 * Les mêmes gestes, sur le compte de quelqu'un d'autre
 *
 * **C'est la version qui servira en novembre.** Un bénévole ne diagnostique
 * pas ses propres notifications pendant l'édition : il répond à « je n'ai pas
 * reçu mon défi ce matin », et celui qui se plaint n'est jamais lui.
 * ---------------------------------------------------------------------- */

function targetId(formData: FormData): string | null {
  const value = String(formData.get("profileId") ?? "").trim();

  return value.length > 0 ? value : null;
}

export async function diagnoseParticipantNotificationsAction(
  _previous: NotificationDiagnosticState,
  formData: FormData,
): Promise<NotificationDiagnosticState> {
  const admin = await requireAdmin();

  if (!admin) return { message: "Cette page n’est plus accessible." };

  const profileId = targetId(formData);
  if (!profileId) return { message: "Participant introuvable." };

  return { report: await diagnoseNotifications(profileId) };
}

/**
 * Journalisé, contrairement au diagnostic.
 *
 * Le diagnostic lit ; celui-ci fait sonner le téléphone de quelqu'un d'autre.
 * C'est la définition d'un geste dont on doit pouvoir dire qui l'a fait.
 */
export async function sendTestToParticipantAction(
  _previous: TestSendState,
  formData: FormData,
): Promise<TestSendState> {
  const admin = await requireAdmin();

  if (!admin) return { message: "Cette page n’est plus accessible." };

  const profileId = targetId(formData);
  if (!profileId) return { message: "Participant introuvable." };

  const report = await sendTestPush(
    profileId,
    buildPayload({
      title: "Test — DEFI Movember",
      body: "Message de vérification envoyé par l’organisation. Rien à faire.",
      url: "/jeu",
      tag: "test",
    }),
  );

  await logAdminAction({
    action: "notifications.test_sent",
    targetTable: "push_subscriptions",
    targetId: profileId,
    payload: {
      devices: report.results.length,
      statuses: report.results.map((result) => result.status),
    },
  });

  return {
    lines: report.results.map(
      (result) =>
        `${result.device} — ${result.status ?? "aucune réponse"} : ${result.detail}`,
    ),
  };
}
