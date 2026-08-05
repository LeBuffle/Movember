"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { parseChallengeConfig } from "@/lib/challenges/config";
import {
  assignDailyChallenges,
  type DrawReport,
} from "@/lib/challenges/daily-draw";
import { parseNumberInput } from "@/lib/challenges/fields";
import {
  buildConfig,
  challengeDetailsSchema,
  DETAIL_LABELS,
  readFormValues,
} from "@/lib/challenges/form";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * Writing to the catalogue, from the back-office.
 *
 * **Through the administrator's own session, not the service key.** Row level
 * security then decides, and it decides on the server with the role read from
 * the database. Reaching for the service key here — as the registration path
 * has to, for reasons of its own — would mean the only thing standing between
 * a crafted request and the catalogue is this file remembering to check.
 *
 * Every action is journalised (story 1.10). A catalogue three people edit in
 * September, from three phones, needs to be able to answer "who changed this
 * challenge, and when" — and it needs to answer it in December.
 */

export type ChallengeFormState = {
  /** Errors on the challenge itself, by field name. */
  fieldErrors?: Record<string, string>;
  /** Errors on the evaluator's settings, as sentences. */
  configErrors?: string[];
  message?: string;
};

export type DrawActionState = {
  report?: DrawReport;
  message?: string;
};

const REFUSED: ChallengeFormState = {
  message: "Cette page n’est plus accessible. Reconnectez-vous.",
};

export async function saveChallenge(
  _previous: ChallengeFormState,
  formData: FormData,
): Promise<ChallengeFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim() || null;

  const details = challengeDetailsSchema.safeParse({
    title: formData.get("title") ?? "",
    description: String(formData.get("description") ?? ""),
    evaluator: String(formData.get("evaluator") ?? ""),
    sport_family: String(formData.get("sport_family") ?? ""),
    difficulty: String(formData.get("difficulty") ?? ""),
    points: parseNumberInput(formData.get("points")) ?? undefined,
    duration_scope: String(formData.get("duration_scope") ?? "day"),
    duration_days: parseNumberInput(formData.get("duration_days")),
  });

  const { config: values, conditions } = readFormValues(formData);

  const fieldErrors: Record<string, string> = {};
  if (!details.success) {
    for (const issue of details.error.issues) {
      const key = String(issue.path[0] ?? "");
      const label = DETAIL_LABELS[key] ?? key;

      fieldErrors[key] ??=
        issue.code === "invalid_type" && issue.input === undefined
          ? `${label} : ce champ est obligatoire.`
          : issue.message;
    }
  }

  // The settings are checked even when the details are wrong, so a volunteer
  // sees everything that needs fixing in one pass rather than discovering the
  // second problem after correcting the first.
  const evaluator = String(formData.get("evaluator") ?? "");
  const checked = parseChallengeConfig(
    evaluator,
    buildConfig(evaluator, values, conditions),
  );

  if (!details.success || !checked.ok) {
    return {
      fieldErrors:
        Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      configErrors: checked.ok ? undefined : checked.errors,
    };
  }

  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return {
      message:
        "L’édition n’a pas été trouvée. Prévenez la personne qui gère la base.",
    };
  }

  const row = {
    edition_id: edition.id,
    title: details.data.title,
    description: details.data.description,
    evaluator: details.data.evaluator,
    config: checked.config,
    sport_family: details.data.sport_family,
    difficulty: details.data.difficulty,
    points: details.data.points,
    duration_scope: details.data.duration_scope,
    duration_days:
      details.data.duration_scope === "day" ? null : details.data.duration_days,
  };

  const saved = id
    ? await supabase
        .from("challenges")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("challenges")
        .insert({ ...row, created_by: admin.id })
        .select("id")
        .maybeSingle();

  if (saved.error || !saved.data) {
    console.error("[défis] enregistrement impossible", {
      code: saved.error?.code,
      message: saved.error?.message,
    });

    return {
      message:
        "Le défi n’a pas pu être enregistré. Réessayez dans un instant — rien n’a été perdu, votre saisie est toujours à l’écran.",
    };
  }

  await logAdminAction({
    action: id ? "challenge.updated" : "challenge.created",
    targetTable: "challenges",
    targetId: saved.data.id,
    payload: {
      title: row.title,
      evaluator: row.evaluator,
      points: row.points,
    },
  });

  revalidatePath("/admin/defis");
  redirect(`/admin/defis?enregistre=${saved.data.id}`);
}

/**
 * Withdraws a challenge from the draw, or puts it back.
 *
 * Never deletes. A deleted challenge would take with it the assignments and
 * results that reference it — the database refuses precisely for that reason
 * (`on delete restrict`, story 4.1). Someone's completed challenge must not
 * disappear from their history because the catalogue was tidied up in
 * December.
 */
export async function setChallengeActive(
  _previous: ChallengeFormState,
  formData: FormData,
): Promise<ChallengeFormState> {
  const admin = await requireAdmin();
  if (!admin) return REFUSED;

  const id = String(formData.get("id") ?? "").trim();
  const active = formData.get("active") === "true";

  if (!id) return { message: "Défi introuvable." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("challenges")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, title")
    .maybeSingle();

  if (error || !data) {
    console.error("[défis] changement d’état impossible", {
      code: error?.code,
    });
    return { message: "L’état du défi n’a pas pu être changé." };
  }

  await logAdminAction({
    action: active ? "challenge.reactivated" : "challenge.deactivated",
    targetTable: "challenges",
    targetId: data.id,
    payload: { title: data.title },
  });

  revalidatePath("/admin/defis");
  return {};
}

/**
 * Running the day's draw by hand.
 *
 * The answer to "the challenges did not go out this morning" — at six in the
 * morning, from a phone, without a terminal. It calls exactly what the
 * scheduled task calls: a second, hand-rolled version of the draw would
 * eventually disagree with the real one, and it would disagree on the morning
 * it was needed.
 *
 * Safe to press twice, and safe to press when the task already ran: everyone
 * who has a challenge is skipped.
 */
export async function runDailyDraw(
  _previous: DrawActionState,
  _formData: FormData,
): Promise<DrawActionState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const report = await assignDailyChallenges();

  await logAdminAction({
    action: "challenges.drawn_manually",
    payload: {
      date: report.date,
      assigned: report.assigned,
      already_had: report.alreadyHad,
      failures: report.failures,
    },
  });

  revalidatePath("/admin/defis/attribution");
  revalidatePath("/jeu");

  return { report };
}
