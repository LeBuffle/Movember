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

/** A window to fetch over, as calendar-free instants. */
export type FetchWindow = {
  /** Inclusive lower bound. */
  after: Date;
  /** Exclusive upper bound. */
  before: Date;
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

  /**
   * The activities of one athlete over a window, already normalised.
   *
   * **A fifth operation, where architecture D3 named four.** The four are the
   * authorisation dance; this is what a source is actually *for*, and leaving
   * it out would have meant every caller reaching around the interface to
   * talk to Strava directly — which is the one thing D3 exists to prevent.
   * The amendment is small and it goes the way the decision intended.
   *
   * Returns `unavailable` when the provider is unreachable or rate-limiting,
   * `denied` when the token is refused. The caller must be able to tell those
   * apart: one is worth retrying, the other never is.
   */
  fetchActivities(
    accessToken: string,
    profileId: string,
    window: FetchWindow,
  ): Promise<SourceResult<Activity[]>>;

  /** One activity by its provider identifier, for a webhook (story 3.5). */
  fetchActivity(
    accessToken: string,
    profileId: string,
    providerActivityId: string,
  ): Promise<SourceResult<Activity>>;

  /**
   * Cuts the authorisation at the provider, not only on our side.
   *
   * Clearing our own token leaves the authorisation live in the
   * participant's provider account: they believe they cut the link, and they
   * have not (story 3.8 AC 6).
   */
  revoke(accessToken: string): Promise<SourceResult<true>>;
};
