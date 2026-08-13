"use server";

import { diagnoseStrava, type Diagnostic } from "@/lib/activities/diagnostic";
import { requireAdmin } from "@/lib/admin/guard";

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
