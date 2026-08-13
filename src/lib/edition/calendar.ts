/**
 * The edition's calendar and collective figures.
 *
 * Same arrangement as the registration tiers: one access point, read by
 * every page, so that moving these to the `editions` table — which already
 * holds `starts_on`, `ends_on`, `registration_opens_on` and
 * `collective_goals` since story 1.6 — is a change to this file alone.
 *
 * It is not read from the database yet on purpose. The public home page is
 * the most visited page of the site and the one a share leads to; keeping it
 * statically rendered, with no request to Supabase, is what makes it open
 * instantly (AC 9). It becomes worth a query once the counter shows real
 * figures, in epic 2.
 */

export type EditionMilestone = {
  label: string;
  date: string;
  detail: string;
};

export const EDITION_YEAR = 2026;

/**
 * The day registrations open, and the single place that decides whether the
 * public page says so.
 *
 * It was a sentence written by hand on the home page, from a time when there
 * was no registration tunnel to open. The tunnel exists since epic 2, and a
 * hard-coded "registrations are not open" would have gone on saying it on
 * the morning of 15 October — with the tier cards below it leading straight
 * to payment. That is the kind of contradiction nobody notices in August and
 * everybody notices on launch day.
 */
export const REGISTRATION_OPENS_ON = "2026-10-15";

/** Whether registrations are open, as of now. */
export function registrationsOpen(now: Date = new Date()): boolean {
  return now >= new Date(`${REGISTRATION_OPENS_ON}T00:00:00+02:00`);
}

/**
 * Dates fixed by the association. November is not negotiable — the whole
 * operation exists to coincide with it.
 */
/**
 * The day the game opens, written the way a contract writes a date.
 *
 * **A refund deadline that disagrees with the first day of play is a refund
 * deadline nobody can defend**, so the terms read it from here rather than
 * spelling it out again. The milestone below carries the same day in machine
 * form; a test keeps the two saying the same thing.
 */
export const GAME_STARTS_ON = "1ᵉʳ novembre 2026";

export const EDITION_MILESTONES: EditionMilestone[] = [
  {
    label: "Mi-octobre",
    date: "2026-10-15",
    detail: "Ouverture des inscriptions",
  },
  {
    label: "1ᵉʳ novembre",
    date: "2026-11-01",
    detail: "Premier défi du jour",
  },
  {
    label: "30 novembre",
    date: "2026-11-30",
    detail: "Dernier défi, classements figés",
  },
];

/**
 * Results of the previous edition, run by the association without this
 * application.
 *
 * Shown as history, never as the current edition's counter. They are real
 * and they are the honest way to say what the effort represents: 5 000 €
 * across 400 participants is 12,50 € each, and 3 500 hours over the month is
 * about seventeen minutes of sport a day.
 */
export const PREVIOUS_EDITION = {
  year: 2025,
  participants: 400,
  amountEuros: 5000,
  kilometres: 30000,
  hours: 3500,
};

/**
 * Collective targets for this edition.
 *
 * Placeholder, and marked as such wherever it is displayed (AC 5). Epic 2
 * replaces `collected` with the real total from the payments table; the
 * targets themselves come from `editions.collective_goals`.
 */
export const COLLECTIVE_GOALS = {
  participants: 600,
  amountEuros: 10000,
  kilometres: 50000,
};
