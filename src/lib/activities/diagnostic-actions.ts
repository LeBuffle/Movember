"use server";

import { diagnoseStrava, type Diagnostic } from "@/lib/activities/diagnostic";
import { importInitialActivities } from "@/lib/activities/sync";
import { requireAdmin } from "@/lib/admin/guard";
import { refreshLeaderboards } from "@/lib/leaderboards/refresh";

/**
 * The diagnostic, behind the administrator guard.
 *
 * It runs on **the administrator's own link**, deliberately. Diagnosing
 * somebody else's would mean an identifier in a form, and a screen that reads
 * another participant's connection state on request — for a screen whose
 * whole job is answering "why does mine not work".
 */

export type DiagnosticState = { report?: Diagnostic; message?: string };

export async function diagnoseStravaAction(
  _previous: DiagnosticState,
  _formData: FormData,
): Promise<DiagnosticState> {
  const admin = await requireAdmin();

  if (!admin) {
    return { message: "Cette page n’est plus accessible." };
  }

  return { report: await diagnoseStrava(admin.id) };
}

/**
 * Re-running the initial import, on demand.
 *
 * **Because the full import happens exactly once, and cannot be asked for
 * again.** It runs when the account is linked; the resynchronisation button
 * looks back two days, which is right for a lost webhook and useless for a
 * link that was made before the edition opened. Without this, a whole month
 * of history is unreachable and the only remedy is unlinking and relinking —
 * a manoeuvre nobody should have to discover on their own.
 *
 * On the administrator's own account, like the diagnostic.
 */
export type ReimportState = { message?: string };

export async function reimportOwnHistoryAction(
  _previous: ReimportState,
  _formData: FormData,
): Promise<ReimportState> {
  const admin = await requireAdmin();

  if (!admin) return { message: "Cette page n’est plus accessible." };

  const outcome = await importInitialActivities(admin.id);

  if (!outcome.ok) {
    return {
      message: `Import impossible — raison technique : ${outcome.reason}. Lancez le diagnostic ci-dessus.`,
    };
  }

  return {
    message:
      `${outcome.received} sortie(s) lue(s) chez Strava, ${outcome.stored} enregistrée(s), ` +
      `${outcome.completed} défi(s) validé(s). ` +
      (outcome.stored > 0 && outcome.completed === 0
        ? "Des sorties sont arrivées sans valider de défi : c’est normal si aucun défi n’était attribué ces jours-là."
        : ""),
  };
}

/**
 * Recomputing the rankings now, instead of waiting for the scheduled pass.
 *
 * **Nothing computes a ranking on demand** — that is the point of the
 * materialised view. Which also means a completed challenge is invisible
 * until the next pass, and during a rehearsal that reads as "the ranking is
 * broken". One button, and the runbook stops asking for a SQL statement.
 */
export async function refreshLeaderboardsAction(
  _previous: ReimportState,
  _formData: FormData,
): Promise<ReimportState> {
  const admin = await requireAdmin();

  if (!admin) return { message: "Cette page n’est plus accessible." };

  const report = await refreshLeaderboards();

  if (report.failed) {
    return { message: "Le rafraîchissement a échoué. Voir les journaux." };
  }

  return {
    message: report.refreshed
      ? "Classements recalculés."
      : "Un recalcul était déjà en cours ; il se termine tout seul.",
  };
}
