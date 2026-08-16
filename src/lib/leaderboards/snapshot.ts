import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Taking the daily photograph of the rankings (story 13.1).
 *
 * **It computes nothing.** It copies the ranks out of the materialised view as
 * they stand, into a table dated by day. That is what makes this incapable of
 * falsifying a ranking: it reads one thing, writes another, and touches
 * neither.
 *
 * Taken at the same moment as the day's challenges, and that is not a
 * coincidence: the participant opens the application in the morning for their
 * challenge, and it is at that instant that "depuis hier" matches what they
 * have in mind.
 *
 * **Replayable.** A second run on the same day writes nothing — the day is
 * part of the primary key, and the insert ignores the conflict. The morning's
 * photograph stays the morning's, which is what "depuis hier matin" claims.
 */

export type SnapshotReport = {
  /** Rows actually written. Zero means "already taken today", a success. */
  written: number;
  failed: boolean;
};

export async function snapshotLeaderboardRanks(): Promise<SnapshotReport> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("snapshot_leaderboard_ranks");

  if (error) {
    console.error("[photographie] prise de vue impossible", {
      code: error.code,
      message: error.message,
    });
    return { written: 0, failed: true };
  }

  const written = Number(data ?? 0);

  if (written === 0) {
    // Already taken today. Normal on a re-run, and not worth an alert.
    console.info("[photographie] déjà prise aujourd’hui");
  } else {
    console.info("[photographie] rangs enregistrés", { written });
  }

  return { written, failed: false };
}
