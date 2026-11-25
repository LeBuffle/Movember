import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The link at the bottom of every e-mail, which has to work without a login.
 *
 * **That is the whole difficulty.** Somebody who wants to stop receiving
 * e-mails is, by definition, somebody who does not want to deal with us —
 * asking them to remember a password first is how an unsubscribe link becomes
 * a spam report. So the link carries its own proof: the participant's
 * identifier and a signature only the server can produce.
 *
 * **The key is derived, not a new secret.** `TOKEN_ENCRYPTION_KEY` already
 * exists (story 3.3) and is already handled properly by the deployment; a
 * second secret would be a second thing to generate, store and forget. It is
 * never used directly here — the label below produces a distinct key, so a
 * signature made for this purpose can never be replayed against another.
 * That separation is standard practice and costs one line.
 *
 * What the token cannot do is anything but unsubscribe: it names no
 * preference and grants no session. The worst somebody who steals one can do
 * is stop somebody else's e-mails, which the participant then sees and can
 * undo from their account.
 */

const LABEL = "defi-movember/unsubscribe/v1";

/** Ten weeks — longer than the edition, shorter than forever. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 70;

function signingKey(): Buffer | null {
  const secret = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) return null;

  return createHmac("sha256", secret).update(LABEL).digest();
}

/**
 * @returns the token, or `null` when the application is not configured to
 *   sign one — in which case the e-mail simply carries no link rather than a
 *   link that refuses.
 */
export function signUnsubscribe(
  profileId: string,
  issuedAt = Date.now(),
): string | null {
  const key = signingKey();
  if (!key) return null;

  const seconds = Math.floor(issuedAt / 1000);
  const body = `${profileId}.${seconds}`;
  const signature = createHmac("sha256", key).update(body).digest("base64url");

  return `${body}.${signature}`;
}

export type UnsubscribeCheck =
  | { ok: true; profileId: string }
  | { ok: false; reason: "malformed" | "expired" | "invalid" };

export function verifyUnsubscribe(
  token: string,
  now = Date.now(),
): UnsubscribeCheck {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [profileId, issued, signature] = parts as [string, string, string];
  const seconds = Number(issued);

  if (!profileId || !Number.isFinite(seconds)) {
    return { ok: false, reason: "malformed" };
  }

  const key = signingKey();
  if (!key) return { ok: false, reason: "invalid" };

  const expected = createHmac("sha256", key)
    .update(`${profileId}.${issued}`)
    .digest("base64url");

  // Compared byte by byte in constant time. The window is small here, but a
  // signature check that leaks its progress through timing is a habit worth
  // not acquiring.
  if (!constantTimeEquals(signature, expected)) {
    return { ok: false, reason: "invalid" };
  }

  // Checked after the signature, deliberately: an expired token and a forged
  // one must not be distinguishable by how long the answer takes.
  if (Math.floor(now / 1000) - seconds > MAX_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, profileId };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}
