import "server-only";

import { simulatedSource } from "@/lib/activities/simulated";
import type { ActivitySource } from "@/lib/activities/source";
import { stravaSource } from "@/lib/activities/sources/strava";

/**
 * Every activity source the application knows, by name.
 *
 * The routes take the provider from the URL and resolve it here, so
 * `/api/activites/connexion/garmin` becomes a working path the day a Garmin
 * source is added to this object — with no route to write and nothing else
 * to touch (NFR19).
 */
const SOURCES: Record<string, ActivitySource> = {
  strava: stravaSource,
  simulated: simulatedSource,
};

/** Sources a participant can actually connect. */
export const CONNECTABLE = ["strava"] as const;

export function activitySource(key: string): ActivitySource | null {
  return SOURCES[key] ?? null;
}

export function isConnectable(key: string): boolean {
  return (CONNECTABLE as readonly string[]).includes(key);
}
