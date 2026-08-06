import "server-only";

import type { Activity } from "@/lib/activities/activity";
import { parisDate, sportFamilyFromProvider } from "@/lib/activities/activity";
import {
  sourceFailure,
  type ActivitySource,
  type SourceCredentials,
  type SourceResult,
} from "@/lib/activities/source";

/**
 * Strava, as an implementation of the one interface the application knows.
 *
 * Everything Strava-specific in the whole codebase is meant to live here and
 * in the two routes that redirect. That is the point of architecture D3: the
 * challenge engine, the screens and the scheduled tasks never learn that
 * `VirtualRun` exists, and adding Garmin after the launch means adding a file
 * beside this one.
 *
 * **The scope requested is `activity:read_all`, and nothing else.** Asking
 * wider "just in case" is what fails a compliance review — and the
 * participant reads the list of permissions on Strava's own screen before
 * approving.
 */

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";

/** Includes private activities, which is why consent is collected first. */
export const STRAVA_SCOPE = "activity:read_all";

function credentials(): { id: string; secret: string } | null {
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;

  return id && secret ? { id, secret } : null;
}

/** Whether a link can be started at all here. */
export function stravaConfigured(): boolean {
  return credentials() !== null;
}

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  athlete?: { id?: unknown };
};

/**
 * Reads a token payload without trusting its shape.
 *
 * Strava is a third party: its response is input, not a promise. A missing
 * refresh token would otherwise be stored as the string "undefined" and the
 * link would break silently a few hours later — the worst possible moment,
 * because nobody would connect the two events.
 */
function readTokens(
  payload: unknown,
  scopes: string[],
): SourceCredentials | null {
  if (typeof payload !== "object" || payload === null) return null;

  const body = payload as TokenResponse;
  const athleteId = body.athlete?.id;

  if (
    typeof body.access_token !== "string" ||
    typeof body.refresh_token !== "string" ||
    typeof body.expires_at !== "number"
  ) {
    return null;
  }

  return {
    // Strava's athlete id is a number; ours is a string, because the next
    // provider's will not be a number.
    providerAccountId: String(athleteId ?? ""),
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(body.expires_at * 1000).toISOString(),
    scopes,
  };
}

async function postTokens(
  body: Record<string, string>,
  scopes: string[],
): Promise<SourceResult<SourceCredentials>> {
  const client = credentials();
  if (!client) return sourceFailure("unsupported");

  let response: Response;

  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: client.id,
        client_secret: client.secret,
        ...body,
      }),
      // Strava is occasionally slow; hanging forever would hold a request
      // open and, on the callback, leave the participant staring at a blank
      // tab with no idea whether they are connected.
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return sourceFailure("unavailable");
  }

  if (response.status === 400 || response.status === 401) {
    // An authorisation code already used, or a refresh token the participant
    // revoked. Retrying will never help, and story 3.7 must be able to tell
    // this apart from "Strava is down".
    return sourceFailure("denied");
  }

  if (!response.ok) return sourceFailure("unavailable");

  const parsed = readTokens(await response.json().catch(() => null), scopes);

  if (!parsed || !parsed.providerAccountId) return sourceFailure("invalid");

  return { ok: true, value: parsed };
}

type StravaActivity = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  sport_type?: unknown;
  start_date_local?: unknown;
  start_date?: unknown;
  distance?: unknown;
  moving_time?: unknown;
  elapsed_time?: unknown;
  total_elevation_gain?: unknown;
  manual?: unknown;
};

const positive = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

export const stravaSource: ActivitySource = {
  key: "strava",
  label: "Strava",

  authorizationUrl(state: string, redirectUri: string): SourceResult<string> {
    const client = credentials();
    if (!client) return sourceFailure("unsupported");

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", client.id);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", STRAVA_SCOPE);
    // `auto` rather than `force`: somebody who already approved us is sent
    // straight back instead of being asked a second time.
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("state", state);

    return { ok: true, value: url.toString() };
  },

  async exchangeCode(code: string, _redirectUri: string) {
    // Scopes are not in the token response — Strava reports them on the
    // callback query string, and the caller passes them on from there.
    return postTokens({ code, grant_type: "authorization_code" }, []);
  },

  async refresh(refreshToken: string) {
    return postTokens(
      { refresh_token: refreshToken, grant_type: "refresh_token" },
      [],
    );
  },

  /**
   * One Strava activity, reduced to what the game needs.
   *
   * **What is dropped here never exists anywhere else** (architecture D9):
   * the polyline, the start and end coordinates, heart rate, power, cadence,
   * detailed altitude. They are the most sensitive things Strava returns —
   * home address and health data — and no challenge in the PRD needs any of
   * them. Story 3.4 hardens this and adds the test that fails the build if a
   * forbidden field ever reappears.
   */
  normalise(raw: unknown, profileId: string): Activity | null {
    if (typeof raw !== "object" || raw === null) return null;

    const source = raw as StravaActivity;

    if (source.id === undefined || source.id === null) return null;

    // The absolute instant, not `start_date_local`. Both answer "when", but
    // only this one can be filed against the game's calendar: the day is
    // computed in Paris, like the draw and like the edition (story 3.4 AC 5).
    // `start_date_local` is the athlete's own wall clock, which drifts from
    // the game's the moment somebody travels.
    const started = source.start_date;
    if (typeof started !== "string" || started.length < 10) return null;

    const localDate = parisDate(started);
    if (!localDate) return null;

    return {
      id: String(source.id),
      provider: "strava",
      profileId,
      name: typeof source.name === "string" ? source.name : "",
      sportFamily: sportFamilyFromProvider(
        String(source.sport_type ?? source.type ?? ""),
      ),
      startedAt: started,
      localDate,
      distanceMeters: Math.round(positive(source.distance)),
      // Moving time, not elapsed: a challenge asking for thirty minutes of
      // effort should not be settled by a two-hour coffee stop.
      durationSeconds: Math.round(
        positive(source.moving_time) || positive(source.elapsed_time),
      ),
      elevationMeters: Math.round(positive(source.total_elevation_gain)),
      // Typed in by hand on Strava rather than recorded by a device. Kept
      // because the PO has already decided these are excluded from
      // evaluation (PRD point P11) — but the exclusion itself is story 9.8.
      // Capturing it now is what makes that story possible without going
      // back to Strava for two hundred activities.
      isManual: source.manual === true,
    };
  },
};
