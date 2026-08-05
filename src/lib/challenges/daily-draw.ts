import "server-only";

import { CATALOGUE_MINIMUM } from "@/lib/challenges/catalogue";
import {
  drawChallenge,
  drawSeed,
  type DrawCandidate,
} from "@/lib/challenges/draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SportFamily } from "@/lib/challenges/sports";

/**
 * Handing out the day's challenges.
 *
 * **This is what removes the obligation to invent a challenge every morning
 * of November** (architecture D13). The catalogue is written in October; the
 * month then runs itself. Which also means that when this task fails, it
 * fails for everybody at once — so it is built to be re-run without thinking.
 *
 * Three things make replaying it safe, and they are deliberately independent:
 *
 *   1. participants who already have a challenge for the day are skipped;
 *   2. the draw itself is deterministic, so a second run reaches the same
 *      conclusion as the first (`draw.ts`);
 *   3. the database refuses a second individual assignment for the same
 *      person and day, whatever the code believes.
 *
 * Runs with the service key: it acts on nobody's behalf, and
 * `challenge_assignments` has no write policy for anyone.
 */

export type DrawReport = {
  date: string;
  participants: number;
  assigned: number;
  alreadyHad: number;
  catchUps: number;
  /** Assignments of the day's common challenge, if there is one. */
  commonAssigned: number;
  failures: number;
  /** Set when the catalogue cannot cover the month any more. */
  warning: string | null;
};

/**
 * The current day in Paris, as a calendar date.
 *
 * Not the server's date. A VPS on UTC turns "the challenge of 1 November"
 * into something handed out at one in the morning on the 31st of October —
 * and the mistake is invisible until somebody notices their challenge changed
 * overnight.
 */
export function todayInParis(now: Date = new Date()): string {
  // `fr-CA` because it formats as `AAAA-MM-JJ`, which is the shape the rest
  // of the application compares. `fr-FR` would give `15/11/2026`.
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
  }).format(now);
}

/**
 * Which sports a participant is known to practise.
 *
 * Empty for now, and honestly so: the activity history arrives with epic 3.
 * Until then every draw takes the "history says nothing" path, which prefers
 * all-purpose challenges — exactly what architecture D13 asks for someone
 * whose history is silent. The filter itself is written and tested; it starts
 * working the day this function has something to return.
 */
async function practisedSports(): Promise<SportFamily[]> {
  return [];
}

export async function assignDailyChallenges(
  date: string = todayInParis(),
): Promise<DrawReport> {
  const admin = createAdminClient();

  const report: DrawReport = {
    date,
    participants: 0,
    assigned: 0,
    alreadyHad: 0,
    catchUps: 0,
    commonAssigned: 0,
    failures: 0,
    warning: null,
  };

  const { data: edition } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    console.error("[tirage] édition introuvable", { year: EDITION_YEAR });
    report.warning = "L’édition n’existe pas.";
    return report;
  }

  const [
    { data: challenges },
    { data: registrations },
    { data: assignments },
    { data: common },
  ] = await Promise.all([
    admin
      .from("challenges")
      .select("id, sport_family")
      .eq("edition_id", edition.id)
      .eq("is_active", true),
    admin
      .from("registrations")
      .select("profile_id")
      .eq("edition_id", edition.id)
      .eq("status", "active"),
    // Every assignment of the edition, once. One query rather than one per
    // participant: at four hundred people over thirty days this is a few
    // thousand rows, and four hundred round trips would be four hundred
    // chances to time out halfway.
    admin
      .from("challenge_assignments")
      .select("profile_id, challenge_id, assigned_for, source")
      .eq("edition_id", edition.id),
    // The day's shared challenge, if the animation scheduled one. Cancelled
    // ones are ignored rather than deleted, so "there was one and it was
    // called off" stays readable.
    admin
      .from("common_challenges")
      .select("challenge_id, mode")
      .eq("edition_id", edition.id)
      .eq("scheduled_for", date)
      .is("cancelled_at", null)
      .maybeSingle(),
  ]);

  const candidates: DrawCandidate[] = (challenges ?? []).map((challenge) => ({
    id: challenge.id,
    sportFamily: challenge.sport_family,
  }));

  report.participants = (registrations ?? []).length;

  if (candidates.length === 0) {
    console.error(
      "[tirage] catalogue vide : aucun défi ne peut être attribué",
      {
        date,
      },
    );
    report.warning =
      "Le catalogue ne contient aucun défi actif : personne n’a reçu de défi.";
    return report;
  }

  if (candidates.length < CATALOGUE_MINIMUM) {
    // Logged as an error on purpose: it reaches Sentry (story 1.11), and the
    // back-office says the same thing on its catalogue screen. The month can
    // still run — with repeats.
    console.error("[tirage] catalogue sous le seuil", {
      active: candidates.length,
      minimum: CATALOGUE_MINIMUM,
    });
    report.warning = `Seulement ${candidates.length} défis actifs sur ${CATALOGUE_MINIMUM} nécessaires : des défis vont se répéter.`;
  }

  const received = new Map<string, string[]>();
  const hasToday = new Set<string>();
  const hasCommonToday = new Set<string>();

  for (const assignment of assignments ?? []) {
    if (assignment.source === "draw") {
      received.set(assignment.profile_id, [
        ...(received.get(assignment.profile_id) ?? []),
        assignment.challenge_id,
      ]);
    }

    if (assignment.assigned_for !== date) continue;

    if (assignment.source === "draw" || assignment.source === "catchup") {
      hasToday.add(assignment.profile_id);
    }

    if (assignment.source === "common") {
      hasCommonToday.add(assignment.profile_id);
    }
  }

  const sports = await practisedSports();

  for (const registration of registrations ?? []) {
    const profileId = registration.profile_id;

    if (common && !hasCommonToday.has(profileId)) {
      const { error } = await admin.from("challenge_assignments").insert({
        profile_id: profileId,
        edition_id: edition.id,
        challenge_id: common.challenge_id,
        assigned_for: date,
        source: "common",
        status: "open",
      });

      if (!error) report.commonAssigned += 1;
      else if (error.code !== "23505") {
        console.error("[tirage] défi commun non attribué", {
          profile: profileId,
          code: error.code,
        });
        report.failures += 1;
      }
    }

    // `replace` means the shared challenge *is* the day's challenge. Deciding
    // this in code rather than asking would produce the wrong surprise one day
    // in two — so the mode was chosen when the animation was scheduled.
    if (common?.mode === "replace") continue;

    if (hasToday.has(profileId)) {
      report.alreadyHad += 1;
      continue;
    }

    const result = drawChallenge({
      candidates,
      alreadyReceived: received.get(profileId) ?? [],
      practisedSports: sports,
      seed: drawSeed(profileId, date),
    });

    if (!result.drawn) {
      report.failures += 1;
      continue;
    }

    const { error } = await admin.from("challenge_assignments").insert({
      profile_id: profileId,
      edition_id: edition.id,
      challenge_id: result.challengeId,
      assigned_for: date,
      source: result.catchUp ? "catchup" : "draw",
      status: "open",
    });

    if (error) {
      // A unique violation means someone else got there first — another run,
      // or a hand on the button. Not a failure: the participant has their
      // challenge, which is the only thing that matters.
      if (error.code === "23505") {
        report.alreadyHad += 1;
        continue;
      }

      console.error("[tirage] attribution impossible", {
        profile: profileId,
        code: error.code,
      });
      report.failures += 1;
      continue;
    }

    report.assigned += 1;
    if (result.catchUp) report.catchUps += 1;
  }

  console.info("[tirage] terminé", report);

  if (report.failures > 0) {
    console.error("[tirage] des participants n’ont pas reçu de défi", {
      date,
      failures: report.failures,
    });
  }

  return report;
}
