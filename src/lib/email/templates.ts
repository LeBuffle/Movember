import type { NotificationPayload } from "@/lib/notifications/payload";
import { absoluteUrl } from "@/lib/site-url";

/**
 * The logo, at the top of every e-mail.
 *
 * **Absolute, and it has to be**: an e-mail is read outside the site, so a
 * path relative to nothing resolves to nothing. Most clients block remote
 * images until the reader allows them, which is why the `alt` text carries the
 * project's name rather than the word "logo" — blocked, the e-mail still says
 * whose it is.
 *
 * Width and height are attributes rather than CSS: Outlook ignores a good deal
 * of the stylesheet and would otherwise render the picture at its natural
 * size, which is four hundred pixels tall.
 *
 * **Used by the welcome e-mail and by nothing else.** The notification
 * fallbacks below load nothing from outside, on purpose: they go out often,
 * and an image blocked by default at the top of a daily reminder is noise
 * asking to be allowed. The welcome e-mail is the opposite case — it arrives
 * once, it is read, it carries a link somebody is about to click, and a bare
 * unbranded message asking that is the exact shape of a phishing attempt.
 */
function logoHtml(): string {
  return `<img src="${escapeAttribute(absoluteUrl("/brand/logo-web.png"))}" width="102" height="110" alt="DEFI Movember" style="display:block;border:0;height:auto;max-width:102px" />`;
}

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
    "DEFI Movember — projet indépendant porté par RéACTION, association loi 1901,",
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
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b8440a;font-weight:600">DEFI Movember</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
    ${body ? `<p style="margin:0 0 20px;color:#525252;line-height:1.5">${escapeHtml(body)}</p>` : ""}
    <p style="margin:0">
      <a href="${escapeAttribute(input.actionUrl)}" style="display:inline-block;background:#b8440a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Ouvrir le jeu</a>
    </p>
  </div>

  <div style="max-width:560px;margin:16px auto 0;font-size:12px;color:#525252;line-height:1.5">
    <p style="margin:0 0 6px">Projet indépendant porté par RéACTION, association loi 1901, sans lien avec la fondation Movember.</p>
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
 * The welcome e-mail, sent once a payment is confirmed (story 2.5).
 *
 * **It is the document the participant will look for in April**, when they go
 * hunting for a tax receipt. So it answers that question itself, in as many
 * words: this was a purchase with a consideration, not a deductible donation,
 * and no receipt will be issued (`CLAUDE.md` §6, FR13). Saying it here rather
 * than only in the terms is the difference between a rule that was published
 * and a rule that was read.
 *
 * It also carries the one thing the participant has to do next — link Strava —
 * because a confirmation that only confirms leaves somebody registered and
 * unable to play.
 *
 * No unsubscribe link, and that is correct: this is a transactional message
 * about a payment, not a mailing. Offering to unsubscribe from a receipt makes
 * no sense, and mail providers do not expect one on this kind of message.
 */
export type WelcomeEmailInput = {
  tierName: string;
  grossCents: number;
  donationCents: number;
  /** Where to go to link Strava. Absolute. */
  gameUrl: string;
};

const TAX_LINE =
  "Votre inscription est un achat avec contrepartie, pas un don au sens " +
  "fiscal. Aucun reçu fiscal ni CERFA ne sera émis, et ce montant n’ouvre " +
  "droit à aucune réduction d’impôt.";

export function welcomeEmail(input: WelcomeEmailInput): EmailContent {
  const subject = "Votre inscription est confirmée — DEFI Movember";

  const amount = euros(input.grossCents);
  const donation = euros(input.donationCents);

  const text = [
    "Votre inscription est confirmée.",
    "",
    `Niveau : ${input.tierName}`,
    `Montant payé : ${amount}`,
    `Montant reversé à la fondation Movember : ${donation}`,
    "",
    TAX_LINE,
    "",
    "La suite, en deux minutes :",
    "1. Reliez votre compte Strava — sans lui, aucun défi ne peut se valider.",
    "2. Installez l’application sur votre écran d’accueil pour recevoir votre",
    "   défi du jour.",
    "",
    `Commencer : ${input.gameUrl}`,
    "",
    "—",
    "DEFI Movember — projet indépendant porté par RéACTION, association loi 1901,",
    "sans lien avec la fondation Movember.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#fafafa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px">
    ${logoHtml()}
    <p style="margin:12px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b8440a;font-weight:600">DEFI Movember</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">Votre inscription est confirmée</h1>

    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">
      <tr>
        <td style="padding:6px 0;color:#525252">Niveau</td>
        <td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(input.tierName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#525252">Montant payé</td>
        <td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(amount)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#525252">Reversé à la fondation</td>
        <td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(donation)}</td>
      </tr>
    </table>

    <p style="margin:0 0 20px;padding:12px;background:#fff5ee;border-left:4px solid #b8440a;color:#525252;line-height:1.5;font-size:14px">
      ${escapeHtml(TAX_LINE)}
    </p>

    <h2 style="margin:0 0 8px;font-size:16px">La suite, en deux minutes</h2>
    <ol style="margin:0 0 20px;padding-left:20px;color:#525252;line-height:1.6">
      <li><strong>Reliez votre compte Strava.</strong> Sans lui, aucun défi ne peut se valider.</li>
      <li><strong>Installez l’application</strong> sur votre écran d’accueil, pour recevoir votre défi du jour.</li>
    </ol>

    <p style="margin:0">
      <a href="${escapeAttribute(input.gameUrl)}" style="display:inline-block;background:#b8440a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Commencer</a>
    </p>
  </div>

  <div style="max-width:560px;margin:16px auto 0;font-size:12px;color:#525252;line-height:1.5">
    <p style="margin:0">Projet indépendant porté par RéACTION, association loi 1901, sans lien avec la fondation Movember.</p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

/** `12,00 €` — la virgule, parce que le message est lu en français. */
function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
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
