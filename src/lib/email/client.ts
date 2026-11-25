import "server-only";

/**
 * Sending an e-mail.
 *
 * **Through Resend's HTTP API directly, without its client library.** One
 * request, three headers, a JSON body — a dependency would add an upgrade to
 * follow and a bundle to trace, for something a `fetch` does in fifteen
 * lines. The project's arbitration rule says the cheapest to maintain wins at
 * equal quality (`CLAUDE.md` §10), and here the quality is identical.
 *
 * **Completely inert without `RESEND_API_KEY`.** Same arrangement as Sentry
 * and Stripe: the application works, the e-mails simply do not go out, and
 * the log says so. That is the right state in development and until the
 * account exists — which is still the case today.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Always sent alongside the HTML. Some clients show only this. */
  text: string;
  /**
   * The one-click unsubscribe header. Mail providers read it and show their
   * own unsubscribe button — which is what keeps a bulk sender out of the
   * spam folder far more effectively than any wording in the body.
   */
  unsubscribeUrl?: string;
};

export type EmailOutcome =
  | { ok: true }
  | { ok: false; reason: "unconfigured" | "refused" | "unreachable" };

const ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
    process.env.RESEND_FROM_ADDRESS?.trim(),
  );
}

export async function sendEmail(message: EmailMessage): Promise<EmailOutcome> {
  if (!emailConfigured()) {
    console.info("[e-mail] non configuré : rien n’est envoyé", {
      subject: message.subject,
    });
    return { ok: false, reason: "unconfigured" };
  }

  const replyTo = process.env.RESEND_REPLY_TO?.trim();

  const headers: Record<string, string> = {};

  if (message.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${message.unsubscribeUrl}>`;
    // Tells the provider the link alone is enough — no confirmation page, no
    // login. Without it, some of them refuse to show their own button.
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_ADDRESS!.trim(),
        to: [message.to],
        /* Where a reply lands.

           Sending from a domain does not create a mailbox on it, and people
           reply to a confirmation e-mail — "je n'ai pas reçu ma médaille",
           "j'ai payé deux fois". Without this, those replies bounce off an
           address nobody owns, and the participant concludes we ignored them.

           An ordinary mailbox the association actually reads is enough; there
           is no reason to buy hosting for the domain just for this. */
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      }),
      // Ten seconds. A send that hangs must not hold a batch of eight
      // hundred; the next run will try again.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // The address is never logged. An audit line outlives the account it
      // refers to, and an e-mail address copied into a log would survive that
      // person's erasure request.
      console.error("[e-mail] refusé", { status: response.status });
      return { ok: false, reason: "refused" };
    }

    return { ok: true };
  } catch {
    console.error("[e-mail] service injoignable");
    return { ok: false, reason: "unreachable" };
  }
}
