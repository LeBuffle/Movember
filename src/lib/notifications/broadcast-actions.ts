"use server";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { isAudience, type Audience } from "@/lib/notifications/audience";
import { audienceMembers } from "@/lib/notifications/broadcast";
import { notify } from "@/lib/notifications/dispatch";
import { buildPayload, safePath } from "@/lib/notifications/payload";

/**
 * Sending a message to the participants, from the back-office.
 *
 * **"Sending a notification must be a form to fill in, never a
 * deployment"** (PRD §2). This is the action that makes the month animatable
 * by the team itself.
 *
 * Three safeguards, in the order they matter:
 *
 * 1. **The count is shown before the send** and comes from the same query the
 *    send uses. A message meant for a few and sent to eight hundred cannot be
 *    taken back.
 * 2. **The message carries its own identifier**, generated when the form is
 *    rendered. A double press, a back button, a refreshed page — all reuse the
 *    same identifier, and the ledger sends nothing the second time.
 * 3. **It is journalised before being counted as done.** A message sent to
 *    every participant is exactly the kind of fact somebody comes back to in
 *    December.
 *
 * It goes through `notify` like everything else, so the preferences of story
 * 6.7 apply — including to a send from the back-office, which is the case the
 * acceptance criterion names explicitly.
 */

export type BroadcastState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  report?: {
    audience: number;
    sent: number;
    emailed: number;
    failed: number;
    skipped: number;
  };
};

const REFUSED: BroadcastState = {
  message: "Cette page n’est plus accessible. Reconnectez-vous.",
};

export async function sendBroadcast(
  _previous: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const rawAudience = String(formData.get("audience") ?? "");
  const messageId = String(formData.get("messageId") ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (title.length < 3) {
    fieldErrors.title = "Écrivez un titre d’au moins 3 caractères.";
  }
  if (title.length > 60) {
    // Refused rather than silently cut: the author has to see their own
    // sentence, not discover on a phone that its point was removed.
    fieldErrors.title = "Le titre ne peut pas dépasser 60 caractères.";
  }
  if (body.length > 160) {
    fieldErrors.body = "Le message ne peut pas dépasser 160 caractères.";
  }
  if (!isAudience(rawAudience)) {
    fieldErrors.audience = "Choisissez à qui envoyer.";
  }
  if (!messageId) {
    fieldErrors.title = "Rechargez la page avant d’envoyer.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const audience = rawAudience as Audience;
  const members = await audienceMembers(audience);

  if (members.length === 0) {
    return {
      message:
        "Personne ne correspond à ce choix. Rien n’a été envoyé, et il n’y a rien à annuler.",
    };
  }

  // Journalised before the send, not after. If the process dies mid-batch,
  // "somebody sent this to everybody" has to remain readable — that question
  // is asked afterwards, never during.
  await logAdminAction({
    action: "notification.broadcast",
    payload: {
      message_id: messageId,
      audience,
      recipients: members.length,
      title,
    },
  });

  const report = await notify({
    profileIds: members,
    category: "annonce",
    payload: buildPayload({ title, body, url: safePath(url || "/jeu") }),
    // Generated when the form was rendered, so a double press or a back
    // button reuses it and the ledger refuses the second send.
    dedupeKey: `annonce:${messageId}`,
  });

  return {
    report: {
      audience: members.length,
      sent: report.sent,
      emailed: report.emailed,
      failed: report.failed,
      skipped: report.skipped,
    },
  };
}
