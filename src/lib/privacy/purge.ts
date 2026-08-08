import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { purgeDueOn, RETENTION_RULES } from "@/lib/privacy/retention";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Applying the retention policy (story 11.4).
 *
 * **It does nothing at all for most of the year, and that is the expected
 * outcome.** The first rule falls due one month after the edition ends; until
 * then every pass reports zero. A task that logs "rien à faire" every night
 * for eleven months is a task somebody trusts in April.
 *
 * Runs with the service key, and it has to: nobody's session is open, and the
 * rows being removed belong to hundreds of different people.
 *
 * **`activity_connections` is emptied rather than deleted.** The row carries
 * the history of the link — connected on this date, disconnected on that one —
 * which the participant can still ask for. What is removed is the pair of
 * tokens, which is the only part that is dangerous to keep. Deleting the row
 * would lose the history and gain nothing.
 */

export type PurgeLine = {
  table: string;
  /** Rows affected, or null when the rule is not due yet. */
  removed: number | null;
  dueOn: string | null;
  error?: string;
};

export type PurgeReport = {
  /** Null when there is no edition to anchor the delays on. */
  editionEndsOn: string | null;
  lines: PurgeLine[];
};

export async function runRetentionPurge(
  now: Date = new Date(),
): Promise<PurgeReport> {
  const admin = createAdminClient();

  const { data: edition, error: editionError } = await admin
    .from("editions")
    .select("id, ends_on")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (editionError || !edition) {
    // No anchor, so no purge. Refusing to guess is the whole point: a purge
    // that ran against a default date would delete a live edition's data.
    console.error("[purge] édition introuvable, aucune purge", {
      year: EDITION_YEAR,
      code: editionError?.code,
    });
    return { editionEndsOn: null, lines: [] };
  }

  const lines: PurgeLine[] = [];

  for (const rule of RETENTION_RULES) {
    const due = purgeDueOn(rule, edition.ends_on, now);

    if (!due) {
      lines.push({ table: rule.table, removed: null, dueOn: null });
      continue;
    }

    const dueOn = due.toISOString().slice(0, 10);

    const outcome =
      rule.table === "activity_connections"
        ? await clearStoredTokens(admin, edition.id)
        : await deleteForEdition(admin, rule.table, edition.id);

    lines.push({ table: rule.table, dueOn, ...outcome });
  }

  const applied = lines.filter((line) => line.removed !== null);

  // Info, not warn: the ordinary result is nothing to do, and a warning every
  // night would train whoever reads the logs to ignore this task.
  console.info("[purge] conservation appliquée", {
    edition: edition.ends_on,
    applied: applied.length,
    removed: applied.reduce((sum, line) => sum + (line.removed ?? 0), 0),
  });

  return { editionEndsOn: edition.ends_on, lines };
}

type Admin = ReturnType<typeof createAdminClient>;

/** Rows of one table belonging to this edition. */
async function deleteForEdition(
  admin: Admin,
  table: string,
  editionId: string,
): Promise<{ removed: number | null; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from(table as any) as any)
    .delete()
    .eq("edition_id", editionId)
    .select("id");

  if (error) {
    console.error("[purge] table non purgée", { table, code: error.code });
    return { removed: null, error: error.code ?? "inconnue" };
  }

  return { removed: (data ?? []).length };
}

/**
 * The tokens, and only the tokens.
 *
 * `activity_connections` has no `edition_id` — a sporting link belongs to a
 * person, not to an edition — so the rule is applied to every link that still
 * holds a token. Which is correct: once the edition is over there is nothing
 * left to synchronise for anybody.
 */
async function clearStoredTokens(
  admin: Admin,
  _editionId: string,
): Promise<{ removed: number | null; error?: string }> {
  const { data, error } = await admin
    .from("activity_connections")
    .update({
      access_token: "",
      refresh_token: "",
      status: "broken",
      disconnected_at: new Date().toISOString(),
    })
    .neq("access_token", "")
    .select("id");

  if (error) {
    console.error("[purge] jetons non effacés", { code: error.code });
    return { removed: null, error: error.code ?? "inconnue" };
  }

  return { removed: (data ?? []).length };
}
