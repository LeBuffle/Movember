/**
 * What the service worker is allowed to keep on the device.
 *
 * This is an ALLOW-LIST, and that is the point. A deny-list ("never cache
 * /mon-compte") is wrong by construction: every route added later is cached
 * by default, and the day someone ships `/mon-equipe` nobody remembers to
 * add it. Here, anything not named below goes straight to the network and
 * leaves nothing behind.
 *
 * The requirement is story 1.8 AC 7, and it is not decoration: a participant
 * connects their Strava account, so the app holds activity data — pace,
 * duration, sometimes location. On a shared or stolen phone that must not be
 * readable from a cache the participant never knew existed.
 *
 * `tests/unit/pwa.test.ts` reads this file and `src/app/sw.ts` together, and
 * fails if the worker ever caches outside these prefixes.
 */

/** Path prefixes the service worker may cache. Nothing else. */
export const CACHEABLE_PREFIXES = [
  /* Build assets. Their filenames contain a content hash, so a cached copy
     can never be stale — a new build produces new filenames. */
  "/_next/static/",
  /* Application icons. Immutable in practice, and they are what makes the
     installed app open instantly. */
  "/icons/",
] as const;

/** Page served when a navigation fails for want of a network. */
export const OFFLINE_PATH = "/hors-ligne";

export function isCacheablePath(pathname: string): boolean {
  return CACHEABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
