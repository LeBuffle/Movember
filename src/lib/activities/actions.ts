"use server";

import { revalidatePath } from "next/cache";

import {
  simulatedActivities,
  simulatedSource,
} from "@/lib/activities/simulated";
import { SIMULATION_ALLOWED } from "@/lib/activities/simulation";
import { recordActivities } from "@/lib/activities/store";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { todayInParis } from "@/lib/challenges/daily-draw";

/**
 * Injecting the made-up activities, on a preproduction environment.
 *
 * The point of story 3.1: the whole engine can be exercised end to end — a
 * challenge drawn, an activity arriving, the challenge completing, points
 * appearing — without a single Strava account. That is what let epic 4 be
 * built before epic 3 existed, and it stays the fastest way to check a
 * change in October.
 *
 * **It cannot run in production**, and the guard is not a hidden button.
 * Made-up activities on the real edition would put points on a real
 * leaderboard, and there is no undoing that quietly.
 */

export type SimulationFormState = {
  message?: string;
  report?: { received: number; stored: number; completed: number };
};

export async function injectSimulatedActivities(
  _previous: SimulationFormState,
  formData: FormData,
): Promise<SimulationFormState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  if (!SIMULATION_ALLOWED) {
    return {
      message:
        "Les activités simulées n’existent pas en production, et c’est délibéré.",
    };
  }

  const profileId = String(formData.get("profileId") ?? "").trim() || admin.id;
  const day = String(formData.get("day") ?? "").trim() || todayInParis();

  // Through the source, not straight from the fixtures. It is the same path
  // Strava will take, so the day this breaks it breaks here first.
  const activities = simulatedActivities(day, profileId)
    .map((sample) => simulatedSource.normalise(sample, profileId))
    .filter((activity) => activity !== null);

  const report = await recordActivities(activities);

  await logAdminAction({
    action: "activities.simulated",
    targetTable: "activities",
    targetId: profileId,
    payload: { day, ...report },
  });

  revalidatePath("/jeu");
  revalidatePath("/jeu/historique");
  revalidatePath("/admin/defis/attribution");

  return {
    report: {
      received: report.received,
      stored: report.stored,
      completed: report.completed,
    },
    message:
      report.stored === 0 && report.received > 0
        ? "Ces activités étaient déjà là : rien n’a été ajouté."
        : undefined,
  };
}
