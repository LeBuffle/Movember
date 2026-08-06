import type { NotificationPayload } from "@/lib/notifications/payload";

/**
 * What a fallback e-mail looks like.
 *
 * Pure, so the wording and the escaping can be tested without sending
 * anything. Three rules govern it, and all three are about deliverability
 * rather than looks — an e-mail in the spam folder is an e-mail that did not
 * exist.
 *
 * **A plain-text part, always.** A message with HTML only is a well-known
 * spam signal, and some clients show nothing else.
 *
 * **No images, no external stylesheet, no tracking pixel.** Nothing to load
 * means nothing blocked, nothing to consent to, and one less thing that makes
 * a message look like marketing when it is a game reminder.
 *
 * **The unsubscribe link is in the body as well as in the headers.** The
 * header is what the provider reads; the link is what a human finds.
 */

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type NotificationEmailInput = {
  payload: NotificationPayload;
  /** Absolute address of the screen the notification points at. */
  actionUrl: string;
  /** Absent when the application cannot sign one — the e-mail still goes. */
  unsubscribeUrl?: string;
};

export function notificationEmail(input: NotificationEmailInput): EmailContent {
  const { title, body } = input.payload;

  const text = [
    title,
    "",
    body,
    "",
    `Ouvrir : ${input.actionUrl}`,
    "",
    "—",
    "DEFI Movember — projet indépendant porté par une association loi 1901,",
    "sans lien avec la fondation Movember.",
    input.unsubscribeUrl
      ? `Ne plus recevoir ces e-mails : ${input.unsubscribeUrl}`
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#fafafa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c2410c;font-weight:600">DEFI Movember</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
    ${body ? `<p style="margin:0 0 20px;color:#525252;line-height:1.5">${escapeHtml(body)}</p>` : ""}
    <p style="margin:0">
      <a href="${escapeAttribute(input.actionUrl)}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Ouvrir le jeu</a>
    </p>
  </div>

  <div style="max-width:560px;margin:16px auto 0;font-size:12px;color:#525252;line-height:1.5">
    <p style="margin:0 0 6px">Projet indépendant porté par une association loi 1901, sans lien avec la fondation Movember.</p>
    ${
      input.unsubscribeUrl
        ? `<p style="margin:0"><a href="${escapeAttribute(input.unsubscribeUrl)}" style="color:#525252">Ne plus recevoir ces e-mails</a></p>`
        : ""
    }
  </div>
</body>
</html>`;

  return { subject: title, html, text };
}

/**
 * Escaping, by hand and on purpose.
 *
 * A challenge title is written by a volunteer in a back-office form. It is
 * not hostile, and it will contain an apostrophe, a `&`, sooner or later a
 * `<`. Interpolating it raw would break the message long before anybody tried
 * anything clever — and would, one day, let a back-office typo become markup
 * in eight hundred inboxes.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
