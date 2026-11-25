/**
 * Strips personal data out of anything on its way to the error reporter.
 *
 * The rule is not negotiable (architecture §8.5, `CLAUDE.md` §6): Sentry is a
 * third party, hosted outside our control, and it must never receive a
 * participant's identity. What an error report naturally carries is exactly
 * what we must not send — the session cookie, the address bar of a
 * confirmation link with its one-time code, the body of the sign-in form
 * with the password in it.
 *
 * Two passes, because either alone leaks.
 *
 * 1. **Named keys are removed** wherever they appear, at any depth. This
 *    catches the structured cases: `request.cookies`, `Authorization`,
 *    `password`.
 * 2. **Every remaining string is rewritten**: query strings are cut off
 *    URLs, and anything shaped like an e-mail address is replaced. This
 *    catches the unstructured cases — a message that happens to quote a URL,
 *    a database error naming the value that violated a unique index.
 *
 * The second pass is the one that matters in practice. The first only
 * removes what we thought of.
 */

/** Removed wherever they appear. Compared in lower case. */
const FORBIDDEN_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "password",
  "passwd",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apikey",
  "secret",
  "email",
  "e-mail",
  "mail",
  "user",
  "username",
  "display_name",
  "ip",
  "ip_address",
  "x-forwarded-for",
  "query_string",
  /* Request bodies. The sign-in form posts a password in here, and there is
     no version of "part of the body" that is safe to keep. */
  "data",
  "body",
]);

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Cuts the query string off a URL.
 *
 * `?code=…` on a confirmation link is a one-time credential; `?suite=…`
 * names the page someone was trying to reach. Neither belongs in a bug
 * report, and the path alone is what tells us where the error happened.
 */
function stripQuery(value: string): string {
  return value.replace(
    /(https?:\/\/[^\s?#]+|\/[^\s?#]*)\?[^\s#]*/g,
    (_match, base: string) => `${base}?[retiré]`,
  );
}

function scrubString(value: string): string {
  return stripQuery(value).replace(EMAIL, "[courriel]");
}

/** Deep enough for a Sentry event, shallow enough not to hang on a cycle. */
const MAX_DEPTH = 12;

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[trop profond]";

  if (typeof value === "string") return scrubString(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        out[key] = "[retiré]";
        continue;
      }
      out[key] = scrubValue(nested, depth + 1);
    }

    return out;
  }

  return value;
}

/**
 * Entry point for Sentry's `beforeSend` and `beforeBreadcrumb`.
 *
 * Returning `null` would drop the report entirely; we scrub and keep it,
 * because an error we cannot see is worse than an error we see without
 * knowing who hit it. Knowing who hit it is not what fixes a bug.
 */
export function scrubEvent<T>(event: T): T {
  return scrubValue(event) as T;
}
