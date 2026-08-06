import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Encrypting provider tokens before they reach the database.
 *
 * **What this protects against, precisely.** A Strava access token opens
 * somebody's entire sporting history, private activities included. The
 * database already refuses to hand these rows to anyone — there is no read
 * policy at all — so the realistic exposure is not a query but a *copy*: a
 * database backup, a dump taken for debugging, a snapshot on a laptop. Those
 * carry no policies with them. Encryption is what makes such a copy worth
 * nothing.
 *
 * AES-256-GCM, which authenticates as well as encrypts: a ciphertext altered
 * in the database fails to decrypt rather than decrypting to something else.
 *
 * **If the key is lost, every link breaks** — and that is recoverable: the
 * participants reconnect their account, which is two taps. Losing the key is
 * therefore an inconvenience, never a data loss. Rotating it has the same
 * effect, which is why there is no rotation mechanism here: it would be more
 * machinery than the situation deserves.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Marks the format, so a future scheme can be told apart from this one. */
const PREFIX = "v1";

function key(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;

  if (!raw) return null;

  // 64 hexadecimal characters — 32 bytes. Generated once with
  // `openssl rand -hex 32` and pasted into the environment file.
  const bytes = /^[0-9a-fA-F]{64}$/.test(raw.trim())
    ? Buffer.from(raw.trim(), "hex")
    : null;

  return bytes?.length === 32 ? bytes : null;
}

/** Whether tokens can be stored at all. Checked before starting a link. */
export function encryptionAvailable(): boolean {
  return key() !== null;
}

/**
 * @returns `null` when no usable key is configured.
 *
 * Returning null rather than falling back to plaintext, and the distinction
 * matters: a missing key must stop a connection from being created, not
 * quietly write a token in clear that everybody will assume is encrypted.
 */
export function encryptToken(plain: string): string | null {
  const secret = key();
  if (!secret) return null;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, secret, iv);

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

/**
 * @returns `null` for anything that does not decrypt cleanly — wrong key,
 *   altered ciphertext, a format from another era. The caller treats that as
 *   a broken link and asks the participant to reconnect, which is the only
 *   honest response.
 */
export function decryptToken(stored: string): string | null {
  const secret = key();
  if (!secret) return null;

  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;

  try {
    const iv = Buffer.from(parts[1]!, "base64");
    const tag = Buffer.from(parts[2]!, "base64");
    const payload = Buffer.from(parts[3]!, "base64");

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

    const decipher = createDecipheriv(ALGORITHM, secret, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(payload), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    // `final()` throws when the authentication tag does not match. That is
    // the mechanism working, not an incident: the row was tampered with, or
    // the key changed.
    return null;
  }
}

/**
 * Compares two secrets without leaking how far they matched.
 *
 * Used for the OAuth `state` on the way back. A plain `===` returns as soon
 * as two characters differ, and the time it took is a measurable hint —
 * small, but there is no reason to hand it out when the fix is one call.
 */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
