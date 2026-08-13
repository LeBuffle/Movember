import "server-only";

import type { Activity } from "@/lib/activities/activity";
import { parisDate, sportFamilyFromProvider } from "@/lib/activities/activity";
import {
  sourceFailure,
  type ActivitySource,
  type FetchWindow,
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
const DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";
const API_URL = "https://www.strava.com/api/v3";

/**
 * How many activities one request brings back.
 *
 * Strava allows up to 200. Asking for the maximum is what keeps an initial
 * import of a whole month to a single call for almost everybody — and the
 * call quota is shared by every participant, so each one saved is one
 * available on a Sunday morning when three hundred outings end at once.
 */
const PAGE_SIZE = 200;

/** A hard stop. Thirty days of sport for one person is far below this. */
const MAX_PAGES = 5;

/** Long enough for a slow answer, short enough not to hold a task open. */
const TIMEOUT_MS = 20_000;

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
    console.warn("[strava] jetons refusés", { status: response.status });
    return sourceFailure("denied");
  }

  if (!response.ok) {
    console.error("[strava] réponse inattendue sur les jetons", {
      status: response.status,
    });
    return sourceFailure("unavailable");
  }

  const parsed = readTokens(await response.json().catch(() => null), scopes);

  if (!parsed || !parsed.providerAccountId) return sourceFailure("invalid");

  return { ok: true, value: parsed };
}

/**
 * One call to Strava's API, with the failures told apart.
 *
 * **429 is its own case, and the most important one.** The call quota is
 * shared by every participant: continuing to knock while rate-limited makes
 * the outage last longer for everybody. It is reported as `unavailable`, and
 * story 3.9 is what backs off on it.
 */
async function callStrava(
  url: string,
  accessToken: string,
): Promise<SourceResult<unknown>> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    // Network, DNS or timeout. Named, because "Strava n'a pas répondu" is
    // also what a 502 produces, and the two are repaired differently.
    console.error("[strava] appel injoignable", {
      why: cause instanceof Error ? cause.name : "inconnu",
    });
    return sourceFailure("unavailable");
  }

  if (response.status === 401 || response.status === 403) {
    // The token was revoked, or the scope is narrower than we assumed.
    // Retrying will never help.
    return sourceFailure("denied");
  }

  if (response.status === 404) {
    console.warn("[strava] ressource introuvable", { url });
    return sourceFailure("invalid");
  }

  if (response.status === 429) {
    console.warn("[strava] quota d’appels atteint");
    return sourceFailure("unavailable");
  }

  if (!response.ok) {
    // **The hole this fills.** Every status that is not one of the four
    // above used to become an unexplained "unavailable", with nothing
    // written anywhere — so a real outage, a malformed window and a Strava
    // 500 were indistinguishable from a phone. The body is read because
    // Strava puts the actual complaint in it.
    const detail = await response.text().catch(() => "");

    console.error("[strava] réponse inattendue", {
      status: response.status,
      detail: detail.slice(0, 300),
    });

    return sourceFailure("unavailable");
  }

  try {
    return { ok: true, value: await response.json() };
  } catch {
    return sourceFailure("invalid");
  }
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
   * Every activity of one athlete over a window.
   *
   * Paged, because a month of sport can exceed one request — and bounded,
   * because a bug in the caller must not turn into an unbounded walk through
   * somebody's entire Strava history.
   */
  async fetchActivities(
    accessToken: string,
    profileId: string,
    window: FetchWindow,
  ): Promise<SourceResult<Activity[]>> {
    const collected: Activity[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = new URL(`${API_URL}/athlete/activities`);
      // Strava counts in whole seconds since the epoch, and both bounds are
      // exclusive on its side — hence the second of slack on `after`.
      url.searchParams.set(
        "after",
        String(Math.floor(window.after.getTime() / 1000) - 1),
      );
      url.searchParams.set(
        "before",
        String(Math.floor(window.before.getTime() / 1000)),
      );
      url.searchParams.set("per_page", String(PAGE_SIZE));
      url.searchParams.set("page", String(page));

      const answer = await callStrava(url.toString(), accessToken);

      if (!answer.ok) return answer;

      const batch = Array.isArray(answer.value) ? answer.value : [];

      for (const raw of batch) {
        const activity = stravaSource.normalise(raw, profileId);
        // One unreadable activity in two hundred must not take the batch
        // down with it.
        if (activity) collected.push(activity);
      }

      // A short page is the last page. Asking for the next would spend a call
      // to be told the same thing.
      if (batch.length < PAGE_SIZE) break;
    }

    return { ok: true, value: collected };
  },

  async fetchActivity(
    accessToken: string,
    profileId: string,
    providerActivityId: string,
  ): Promise<SourceResult<Activity>> {
    const answer = await callStrava(
      `${API_URL}/activities/${encodeURIComponent(providerActivityId)}`,
      accessToken,
    );

    if (!answer.ok) return answer;

    const activity = stravaSource.normalise(answer.value, profileId);

    return activity ? { ok: true, value: activity } : sourceFailure("invalid");
  },

  async revoke(accessToken: string): Promise<SourceResult<true>> {
    const client = credentials();
    if (!client) return sourceFailure("unsupported");

    try {
      const response = await fetch(DEAUTHORIZE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // A token Strava has already forgotten answers 401, and that is the
      // outcome we wanted: the authorisation is gone either way.
      if (response.ok || response.status === 401)
        return { ok: true, value: true };
    } catch {
      return sourceFailure("unavailable");
    }

    return sourceFailure("unavailable");
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
