/**
 * The entry code for a non-production environment.
 *
 * **Replaces the HTTP password of story 1.3**, and for a reason that is not
 * comfort. A browser password lives in the browser's own credential store,
 * which an installed application does not share: on a phone, the application
 * added to the home screen has no address bar to ask, so it answers
 * `401 Unauthorized` and stops there. That made the one environment where the
 * installed application can be checked the one place it could not be checked.
 *
 * **What is given up.** The protection moves from the server to our code: a
 * bug here opens the preproduction, where a bug in Traefik's password would
 * not. Accepted knowingly — this environment holds test payments and made-up
 * activities, and the alternative was an environment nobody can test.
 *
 * **Production is never gated.** The check is skipped there outright rather
 * than relying on the variable being unset, because "we forgot to unset it"
 * is a far more likely accident than "we forgot to set it".
 */

export const GATE_COOKIE = "acces_preprod";

/** Thirty days: long enough that nobody re-types it, short enough to expire. */
export const GATE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * @returns the code in force, or `null` when this environment has no gate —
 *   production, or a local run where nobody set one.
 */
export function gateCode(): string | null {
  if (process.env.APP_ENVIRONMENT === "production") return null;

  const code = process.env.ACCESS_CODE?.trim();

  return code && code.length >= 6 ? code : null;
}

/**
 * The value the cookie has to carry.
 *
 * Not the code itself: a cookie is readable by anyone holding the device, and
 * writing the code in it would hand it over to whoever borrows the phone for
 * a minute. A keyed digest can be checked without being reversible.
 *
 * **Web Crypto rather than `node:crypto`**, and asynchronous because of it.
 * This runs inside the middleware, which executes on the edge runtime where
 * Node's modules do not exist — a detail that only shows up when the
 * application is built, never while developing.
 */
export async function gateToken(code: string): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(code),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("acces-preproduction"),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function gateTokenMatches(
  presented: string | undefined,
  code: string,
): Promise<boolean> {
  if (!presented) return false;

  return constantTimeEquals(presented, await gateToken(code));
}

/**
 * Compares without leaking how far two values matched.
 *
 * Written out rather than borrowed from Node: the edge runtime has no
 * `timingSafeEqual`. Every character is read whatever happens, so the time
 * taken says nothing about where the first difference was.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;

  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

/**
 * Paths that answer before the gate.
 *
 * Each one is here for a reason, and none of them exposes a page:
 * the gate screen itself, obviously; the manifest and icons, because a phone
 * fetches them outside the page context with no cookie and would otherwise
 * draw a letter on a coloured square; and the service worker, which the
 * browser fetches the same way.
 *
 * Webhooks and scheduled tasks are not listed because the middleware never
 * runs on them at all — they authenticate by signature or by secret.
 */
const OPEN_PATHS = [
  "/acces",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
  "/hors-ligne",
];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
