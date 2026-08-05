import type { Activity, ActivityProvider } from "@/lib/activities/activity";

/**
 * What an activity source is, as far as the application is concerned.
 *
 * **The application does not know Strava** (architecture D3). It knows this
 * interface, and Strava is its first real implementation. Four operations,
 * and no fifth: start the authorisation, exchange the code, refresh the
 * token, normalise an activity.
 *
 * Written while only one source exists, and that is the whole point. Adding
 * Garmin after the launch (NFR19) then costs one file rather than a rewrite,
 * and if Strava's terms ever impose an unexpected restriction, this is the
 * single place to adjust. The cost is half a day; catching up afterwards
 * would be counted in weeks.
 *
 * A source that cannot do one of the four says so — it returns
 * `unsupported`, rather than throwing or pretending. The simulated source of
 * this story authorises nothing, and that is a legitimate answer to the
 * contract, not a hole in it.
 */

export type SourceFailure =
  /** This source does not offer that operation at all. */
  | "unsupported"
  /** The participant refused, or the authorisation was withdrawn. */
  | "denied"
  /** The provider is unreachable or rate-limiting us (story 3.9). */
  | "unavailable"
  /** The provider answered something we cannot use. */
  | "invalid";

export type SourceResult<T> =
  { ok: true; value: T } | { ok: false; reason: SourceFailure };

export function sourceFailure<T>(reason: SourceFailure): SourceResult<T> {
  return { ok: false, reason };
}

/**
 * What a successful authorisation yields.
 *
 * Never leaves the server. The table that stores these has no read policy
 * for participants at all — a token here opens somebody's entire sporting
 * history.
 */
export type SourceCredentials = {
  /** The athlete's identifier at the provider. */
  providerAccountId: string;
  accessToken: string;
  refreshToken: string;
  /** ISO 8601. Used to refresh *before* expiry, not after a failed call. */
  expiresAt: string;
  scopes: string[];
};

export type ActivitySource = {
  readonly key: ActivityProvider;
  /** Said the way a participant would say it: "Strava". */
  readonly label: string;

  /** Where to send the participant. `state` guards the return trip. */
  authorizationUrl(state: string, redirectUri: string): SourceResult<string>;

  /** Server-side only: the client secret never reaches a browser. */
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<SourceResult<SourceCredentials>>;

  refresh(refreshToken: string): Promise<SourceResult<SourceCredentials>>;

  /**
   * One provider payload, turned into the internal format.
   *
   * @returns `null` when the payload cannot be understood. Returning null
   *   rather than throwing is deliberate: one unreadable activity in a batch
   *   of two hundred must not take the batch down with it.
   */
  normalise(raw: unknown, profileId: string): Activity | null;
};
