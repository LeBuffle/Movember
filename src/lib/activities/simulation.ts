import { APP_ENVIRONMENT } from "@/lib/app-version";

/**
 * Whether made-up activities may be injected here.
 *
 * Its own module, and not a constant in the server action, because the
 * screen and the action both need it and a `"use server"` file may only
 * export async functions. Two copies of this condition would drift, and the
 * copy that drifts is the one that lets fixtures into production.
 *
 * Made-up activities on the real edition would put points on a real
 * leaderboard, and there is no undoing that quietly.
 */
export const SIMULATION_ALLOWED = APP_ENVIRONMENT !== "production";
