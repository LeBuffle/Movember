import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The day the edition opens, as the database holds it.
 *
 * **One place, because this date decides two very different things**: how far
 * back an activity import reaches, and whether a screen should explain that
 * the game has not started. It was hard-coded as 1 November in the import and
 * read from `editions.starts_on` in the challenge evaluation — two answers to
 * one question, with nothing to make them agree.
 *
 * Keeping it in the row is also what lets preproduction be opened earlier
 * than production: one SQL statement on that environment, no deployment and
 * no branch in the code.
 *
 *   update public.editions set starts_on = '2026-08-01' where year = 2026;
 *
 * ⚠️ Moving this date moves the game with it. The retroactive window of a
 * fil rouge reaches back to it (story 4.5), so a "20 jours d'activité"
 * challenge drawn in preproduction will look back to the new start. That is
 * the point of moving it — it is not a side effect to be surprised by.
 */

/** Where it lands if the row cannot be read. November is the real edition. */
export const DEFAULT_EDITION_START = new Date(Date.UTC(EDITION_YEAR, 10, 1));

export async function editionStartDate(): Promise<Date> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("editions")
    .select("starts_on")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (error || !data?.starts_on) {
    console.error("[édition] date de début illisible, repli au 1ᵉʳ novembre", {
      code: error?.code,
    });

    // Falling back rather than refusing: an import that stops because a
    // lookup failed is worse than an import over the intended month.
    return DEFAULT_EDITION_START;
  }

  // The column is a date; the day is taken whole, from its first second.
  return new Date(`${data.starts_on}T00:00:00Z`);
}

/** Whether there is anything to fetch or to play yet. */
export async function editionHasStarted(
  now: Date = new Date(),
): Promise<boolean> {
  return now >= (await editionStartDate());
}
