import type { Activity } from "@/lib/activities/activity";
import { addDays } from "@/lib/activities/activity";
import {
  sourceFailure,
  type ActivitySource,
  type SourceCredentials,
  type SourceResult,
} from "@/lib/activities/source";

/**
 * Made-up activities, so the engine can be built before Strava exists.
 *
 * This properly belongs to story 3.1. It is delivered here because epic 4 is
 * being built before epic 3, and without it nothing in the challenge engine
 * can be exercised at all.
 *
 * It stays useful afterwards, which is the better reason to write it
 * carefully: an evaluator is tested against activities that were *chosen* —
 * one metre short, exactly on the threshold, the wrong sport, the day before
 * — not against whatever Strava happened to return that week.
 *
 * **Everything here is deterministic.** No random values and no clock: a test
 * that passes on Tuesday and fails on Wednesday is worse than no test, and a
 * fixture that changes shape between runs cannot be reasoned about.
 */

type Sample = Omit<
  Activity,
  "profileId" | "localDate" | "startedAt" | "isManual"
> & {
  /** Days from the reference date. 0 is the day itself, -1 the day before. */
  dayOffset: number;
  hour: number;
  /** Typed in by hand rather than recorded. Absent means recorded. */
  isManual?: boolean;
};

const SAMPLES: Sample[] = [
  {
    id: "sim-run-5k",
    provider: "simulated",
    name: "Cinq bornes au réveil",
    sportFamily: "run",
    distanceMeters: 5000,
    durationSeconds: 1680,
    elevationMeters: 32,
    dayOffset: 0,
    hour: 7,
  },
  {
    id: "sim-run-just-short",
    provider: "simulated",
    name: "Presque cinq bornes",
    sportFamily: "run",
    // One metre short. The case that decides whether an evaluator is fair or
    // merely approximately fair.
    distanceMeters: 4999,
    durationSeconds: 1675,
    elevationMeters: 30,
    dayOffset: 0,
    hour: 12,
  },
  {
    id: "sim-run-long",
    provider: "simulated",
    name: "Sortie longue du dimanche",
    sportFamily: "run",
    distanceMeters: 18400,
    durationSeconds: 6300,
    elevationMeters: 210,
    dayOffset: 0,
    hour: 9,
  },
  {
    id: "sim-bike-commute",
    provider: "simulated",
    name: "Aller-retour au bureau",
    sportFamily: "bike",
    distanceMeters: 24300,
    durationSeconds: 3900,
    elevationMeters: 150,
    dayOffset: 0,
    hour: 8,
  },
  {
    id: "sim-swim",
    provider: "simulated",
    name: "Longueurs à la piscine",
    sportFamily: "swim",
    distanceMeters: 1500,
    durationSeconds: 2700,
    elevationMeters: 0,
    dayOffset: 0,
    hour: 19,
  },
  {
    id: "sim-walk-evening",
    provider: "simulated",
    name: "Marche digestive",
    sportFamily: "walk",
    distanceMeters: 3200,
    durationSeconds: 2400,
    elevationMeters: 12,
    dayOffset: 0,
    hour: 21,
  },
  {
    id: "sim-strength",
    provider: "simulated",
    name: "Séance de renforcement",
    sportFamily: "strength",
    // No distance at all, and that is not an error: a weights session covers
    // no ground. A distance challenge must refuse it on the figure, not
    // stumble over a missing one.
    distanceMeters: 0,
    durationSeconds: 2700,
    elevationMeters: 0,
    dayOffset: 0,
    hour: 18,
  },
  {
    id: "sim-run-yesterday",
    provider: "simulated",
    name: "Footing de la veille",
    sportFamily: "run",
    distanceMeters: 8000,
    durationSeconds: 2700,
    elevationMeters: 40,
    dayOffset: -1,
    hour: 18,
  },
  {
    id: "sim-run-tomorrow",
    provider: "simulated",
    name: "Footing du lendemain",
    sportFamily: "run",
    distanceMeters: 8000,
    durationSeconds: 2700,
    elevationMeters: 40,
    dayOffset: 1,
    hour: 7,
  },
  {
    id: "sim-manual-entry",
    provider: "simulated",
    name: "Sortie saisie à la main",
    sportFamily: "run",
    // Generous, and typed in by hand — which is exactly the shape of a
    // fabricated activity. Nothing filters on it yet (story 9.8 does), but
    // the fixture exists so that story has a case to work from.
    distanceMeters: 21_000,
    durationSeconds: 5400,
    elevationMeters: 0,
    dayOffset: 0,
    hour: 14,
    isManual: true,
  },
  {
    id: "sim-hike-elevation",
    provider: "simulated",
    name: "Randonnée dans les Vosges",
    sportFamily: "walk",
    distanceMeters: 12500,
    durationSeconds: 14400,
    elevationMeters: 820,
    dayOffset: 0,
    hour: 10,
  },
];

/**
 * The sample set, dated relative to a reference day.
 *
 * The reference is passed in rather than read from a clock, so that a caller
 * — a test, a preview screen — decides what "today" means.
 */
export function simulatedActivities(
  referenceDate: string,
  profileId = "profil-simule",
): Activity[] {
  return SAMPLES.map(({ dayOffset, hour, isManual, ...sample }) => {
    const localDate = addDays(referenceDate, dayOffset);

    return {
      ...sample,
      profileId,
      localDate,
      startedAt: `${localDate}T${String(hour).padStart(2, "0")}:00:00.000Z`,
      isManual: isManual ?? false,
    };
  });
}

/** Those on the reference day itself — what a preview should show. */
export function simulatedActivitiesForDay(
  referenceDate: string,
  profileId?: string,
): Activity[] {
  return simulatedActivities(referenceDate, profileId).filter(
    (activity) => activity.localDate === referenceDate,
  );
}

/* -------------------------------------------------------------------------
 * The same fixtures, as a source (architecture D3)
 *
 * It authorises nothing, exchanges nothing and refreshes nothing — and says
 * so, rather than throwing. "This source has no authorisation" is a
 * legitimate answer to the contract, not a hole in it: the interface stays
 * total, and the caller handles one shape of failure whichever source it is
 * talking to.
 * ---------------------------------------------------------------------- */

const noAuthorisation = <T>(): SourceResult<T> => sourceFailure("unsupported");

export const simulatedSource: ActivitySource = {
  key: "simulated",
  label: "Activités simulées",

  authorizationUrl: () => noAuthorisation<string>(),
  exchangeCode: async () => noAuthorisation<SourceCredentials>(),
  refresh: async () => noAuthorisation<SourceCredentials>(),
  revoke: async () => noAuthorisation<true>(),

  /**
   * The fixtures for the window asked, dated on it.
   *
   * Made-up activities have no history of their own: they are generated
   * around a reference day. Answering with the fixtures for the window's own
   * last day is what makes a catch-up rehearsable end to end without Strava.
   */
  async fetchActivities(
    _accessToken: string,
    profileId: string,
    window: { after: Date; before: Date },
  ): Promise<SourceResult<Activity[]>> {
    const reference = window.before.toISOString().slice(0, 10);

    return { ok: true, value: simulatedActivities(reference, profileId) };
  },

  async fetchActivity(
    _accessToken: string,
    profileId: string,
    providerActivityId: string,
  ): Promise<SourceResult<Activity>> {
    const found = simulatedActivities("2026-11-15", profileId).find(
      (activity) => activity.id === providerActivityId,
    );

    return found ? { ok: true, value: found } : sourceFailure("invalid");
  },

  /**
   * The fixtures already have the internal shape, so normalising one is
   * checking that it really is one — which is the useful half of the job,
   * and the half a made-up payload would otherwise skip.
   */
  normalise(raw: unknown, profileId: string): Activity | null {
    if (typeof raw !== "object" || raw === null) return null;

    const sample = raw as Partial<Activity>;

    if (
      typeof sample.id !== "string" ||
      typeof sample.localDate !== "string" ||
      typeof sample.startedAt !== "string" ||
      typeof sample.sportFamily !== "string"
    ) {
      return null;
    }

    return {
      id: sample.id,
      provider: "simulated",
      profileId,
      name: sample.name ?? "",
      sportFamily: sample.sportFamily,
      startedAt: sample.startedAt,
      localDate: sample.localDate,
      distanceMeters: sample.distanceMeters ?? 0,
      durationSeconds: sample.durationSeconds ?? 0,
      elevationMeters: sample.elevationMeters ?? 0,
      isManual: sample.isManual === true,
    };
  },
};
