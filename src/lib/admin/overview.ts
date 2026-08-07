import "server-only";

import { todayInParis } from "@/lib/challenges/daily-draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * What the organisation needs to know on opening the back-office (stories
 * 8.1, 8.4).
 *
 * **The first question of a November morning is not "where are the cards".**
 * It is "did this morning's draw work". The home screen used to be a list of
 * sections; it says nothing about that, and finding out meant opening the
 * assignment screen and reading it.
 *
 * Every alert here carries the address of the screen that resolves it. An
 * alert that leads nowhere is a worry, not information.
 */

export type Alert = {
  /** `danger` interrupts the morning; `warning` is for this week. */
  tone: "danger" | "warning";
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type Overview = {
  today: string;
  /** Participants whose registration is active. */
  participants: number;
  /** Challenges assigned for today. */
  assigned: number;
  /** Of those, how many are already settled. */
  completed: number;
  catalogue: CatalogueState;
  alerts: Alert[];
};

/**
 * The state of the challenge catalogue (story 8.4).
 *
 * **Running out of challenges is the most visible defect of the game.** When
 * there is nothing left to draw, everybody receives the same catch-up
 * challenge (story 4.4) — the mechanism holds, but the game stops being
 * personal, which is the whole of its appeal.
 */
export type CatalogueState = {
  /** Challenges available for the draw. */
  available: number;
  /** Already handed out at least once. */
  used: number;
  /** Participants to serve each day. */
  dailyNeed: number;
  /**
   * How many days the catalogue lasts at the current rate, or `null` when
   * nothing is being drawn yet and the question does not arise.
   */
  daysLeft: number | null;
};

const EMPTY: Overview = {
  today: "",
  participants: 0,
  assigned: 0,
  completed: 0,
  catalogue: { available: 0, used: 0, dailyNeed: 0, daysLeft: null },
  alerts: [],
};

export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();
  const today = todayInParis();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return { ...EMPTY, today };

  const [participants, todays, catalogue, unpublishedCards, brokenLinks] =
    await Promise.all([
      countActiveRegistrations(edition.id),
      countTodaysAssignments(edition.id, today),
      catalogueState(edition.id),
      countUnpublishedCards(edition.id),
      countBrokenConnections(),
    ]);

  const state: CatalogueState = {
    ...catalogue,
    dailyNeed: participants,
    daysLeft:
      participants > 0 ? Math.floor(catalogue.available / participants) : null,
  };

  return {
    today,
    participants,
    assigned: todays.assigned,
    completed: todays.completed,
    catalogue: state,
    alerts: buildAlerts({
      participants,
      assigned: todays.assigned,
      catalogue: state,
      unpublishedCards,
      brokenLinks,
    }),
  };
}

/**
 * The alerts, in the order somebody should act on them.
 *
 * Ordered by consequence, not by category: a draw that did not happen is a
 * morning where six hundred people have nothing to do, and it comes before a
 * card waiting to be published.
 */
function buildAlerts(input: {
  participants: number;
  assigned: number;
  catalogue: CatalogueState;
  unpublishedCards: number;
  brokenLinks: number;
}): Alert[] {
  const alerts: Alert[] = [];

  if (input.participants > 0 && input.assigned === 0) {
    alerts.push({
      tone: "danger",
      title: "Aucun défi attribué aujourd’hui",
      detail:
        "Le tirage du matin n’a pas eu lieu, ou il a échoué. Relancez-le : le rejouer est sans risque, personne ne reçoit deux défis.",
      href: "/admin/defis/attribution",
      action: "Lancer l’attribution",
    });
  }

  if (
    input.catalogue.daysLeft !== null &&
    input.catalogue.daysLeft <= 7 &&
    input.catalogue.available > 0
  ) {
    alerts.push({
      tone: "warning",
      title: `Le catalogue tient ${input.catalogue.daysLeft} jour${input.catalogue.daysLeft > 1 ? "s" : ""}`,
      detail:
        "Au-delà, chaque participant recevra le même défi de rattrapage — le jeu cesse d’être personnel.",
      href: "/admin/defis",
      action: "Écrire des défis",
    });
  }

  if (input.catalogue.available === 0) {
    alerts.push({
      tone: "danger",
      title: "Le catalogue est vide",
      detail:
        "Aucun défi disponible au tirage. Tant qu’il en manque, tout le monde reçoit le défi de rattrapage.",
      href: "/admin/defis",
      action: "Écrire des défis",
    });
  }

  if (input.unpublishedCards > 0) {
    alerts.push({
      tone: "warning",
      title: `${input.unpublishedCards} carte${input.unpublishedCards > 1 ? "s" : ""} en brouillon`,
      detail:
        "Une carte non publiée ne peut être ni tirée ni gagnée : elle n’existe pas pour les participants.",
      href: "/admin/cartes",
      action: "Voir les cartes",
    });
  }

  if (input.brokenLinks > 0) {
    alerts.push({
      tone: "warning",
      title: `${input.brokenLinks} liaison${input.brokenLinks > 1 ? "s" : ""} sportive${input.brokenLinks > 1 ? "s" : ""} rompue${input.brokenLinks > 1 ? "s" : ""}`,
      detail:
        "Ces participants ne voient plus leurs défis se valider. Ils sont prévenus dans l’application, mais une relance vaut mieux.",
      href: "/admin/participants",
      action: "Voir les participants",
    });
  }

  return alerts;
}

async function countActiveRegistrations(edition: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", edition)
    .eq("status", "active");

  return count ?? 0;
}

async function countTodaysAssignments(
  edition: string,
  today: string,
): Promise<{ assigned: number; completed: number }> {
  const supabase = await createClient();

  const [all, done] = await Promise.all([
    supabase
      .from("challenge_assignments")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition)
      .eq("assigned_for", today),
    supabase
      .from("challenge_assignments")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition)
      .eq("assigned_for", today)
      .eq("status", "completed"),
  ]);

  return { assigned: all.count ?? 0, completed: done.count ?? 0 };
}

async function catalogueState(
  edition: string,
): Promise<Pick<CatalogueState, "available" | "used">> {
  const supabase = await createClient();

  const [available, used] = await Promise.all([
    supabase
      .from("challenges")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition)
      .eq("is_active", true),
    supabase
      .from("challenge_assignments")
      .select("challenge_id", { count: "exact", head: true })
      .eq("edition_id", edition),
  ]);

  return { available: available.count ?? 0, used: used.count ?? 0 };
}

async function countUnpublishedCards(edition: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", edition)
    .is("published_at", null);

  return count ?? 0;
}

async function countBrokenConnections(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("activity_connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "broken")
    .is("disconnected_at", null);

  return count ?? 0;
}
