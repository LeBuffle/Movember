/**
 * The one-shot value that guards the return trip from a provider.
 *
 * **Without it, a link can be forced.** A URL prepared by somebody else, sent
 * by message and clicked once, attaches *their* Strava account to the
 * victim's game account — and every activity they record from then on scores
 * for the victim. The value is generated server-side, kept in a cookie the
 * browser cannot read, compared on the way back, and burned whatever the
 * outcome.
 *
 * Its own module rather than a constant in the route that sets it: Next.js
 * only allows a route file to export request handlers and a short list of
 * configuration fields, so anything shared between two routes has to live
 * beside them. The build says so plainly, which is how this got moved.
 */

export const STATE_COOKIE = "connexion_activite";

/** Ten minutes: long enough to read the provider's screen, short enough to matter. */
export const STATE_TTL_SECONDS = 600;
