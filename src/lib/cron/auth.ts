import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Authenticates a scheduled task.
 *
 * The system cron on the VPS calls routes under `/api/cron/*` (architecture
 * decision D7). Those routes do consequential things — from epic 4 onwards
 * they hand out the day's challenges and draw cards — so the only thing
 * standing between them and the open internet is this shared secret.
 *
 * Three properties, and the third is the one that is easy to miss.
 *
 * 1. **Compared in constant time.** A plain `===` returns as soon as two
 *    characters differ, and the time it takes leaks how much of the secret
 *    was guessed. Feeding it one character at a time recovers the whole
 *    thing. Hashing both sides first makes the lengths equal, which is what
 *    `timingSafeEqual` requires.
 * 2. **Never in the address.** The secret travels in a header, because a
 *    query string ends up in every access log along the way.
 * 3. **Refuses when unconfigured.** A missing `CRON_SECRET` means the route
 *    is open, not that it is convenient. The only safe answer is no.
 */
const HEADER = "x-cron-secret";

export function isAuthorisedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;

  // Refusing is the point: an unconfigured secret would otherwise leave
  // every scheduled route reachable by anyone.
  if (!expected || expected.length < 16) return false;

  const provided =
    request.headers.get(HEADER) ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!provided) return false;

  const digest = (value: string) =>
    createHash("sha256").update(value, "utf8").digest();

  return timingSafeEqual(digest(provided), digest(expected));
}

/**
 * The answer given to an unauthenticated caller.
 *
 * A bare 401 with no body: nothing about what the route does, nothing about
 * whether the secret was close. `Cache-Control` because a cached refusal —
 * or worse, a cached success — would be its own vulnerability.
 */
export function cronUnauthorised(): Response {
  return new Response(null, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}
