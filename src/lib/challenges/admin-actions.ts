"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { parseChallengeConfig } from "@/lib/challenges/config";
import {
  assignDailyChallenges,
  todayInParis,
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

export type CommonFormState = {
  errors?: Record<string, string>;
  message?: string;
  scheduled?: boolean;
  cancelled?: boolean;
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

/**
 * Scheduling the challenge everybody gets that day.
 *
 * The mode is asked for, never inferred. "In addition" and "instead" both
 * make sense — one loads the day, the other lightens it — and a code that
 * chose for the animation team would be wrong one day in two.
 */
export async function scheduleCommonChallenge(
  _previous: CommonFormState,
  formData: FormData,
): Promise<CommonFormState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const challengeId = String(formData.get("challengeId") ?? "").trim();
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim();
  const mode = String(formData.get("mode") ?? "");

  const errors: Record<string, string> = {};

  if (!challengeId) errors.challengeId = "Choisissez un défi.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
    errors.scheduledFor = "Indiquez une date.";
  } else if (scheduledFor < todayInParis()) {
    // A day already gone has already had its challenges handed out.
    errors.scheduledFor = "Cette date est passée.";
  }
  if (mode !== "replace" && mode !== "additional") {
    errors.mode = "Précisez si ce défi remplace celui du jour ou s’y ajoute.";
  }

  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return { message: "L’édition n’a pas été trouvée." };

  const { error } = await supabase.from("common_challenges").insert({
    edition_id: edition.id,
    challenge_id: challengeId,
    scheduled_for: scheduledFor,
    mode: mode as "replace" | "additional",
    created_by: admin.id,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        errors: {
          scheduledFor: "Un défi commun est déjà prévu ce jour-là.",
        },
      };
    }

    console.error("[défi commun] programmation impossible", {
      code: error.code,
    });
    return { message: "Le défi commun n’a pas pu être programmé." };
  }

  await logAdminAction({
    action: "common_challenge.scheduled",
    targetTable: "common_challenges",
    targetId: challengeId,
    payload: { scheduled_for: scheduledFor, mode },
  });

  revalidatePath("/admin/defis/attribution");
  return { scheduled: true };
}

/**
 * Calling one off, while the day is still ahead.
 *
 * Cancelled rather than deleted: "there was a common challenge that day and
 * it was called off" is a fact worth being able to read in December. And only
 * before the day arrives — cancelling afterwards would take a challenge away
 * from people already looking at it.
 */
export async function cancelCommonChallenge(
  _previous: CommonFormState,
  formData: FormData,
): Promise<CommonFormState> {
  const admin = await requireAdmin();
  if (!admin) return { message: "Cette page n’est plus accessible." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { message: "Défi commun introuvable." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("common_challenges")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .is("cancelled_at", null)
    // The guard carried by the write itself, not by a check made a moment
    // earlier: the day can turn over between the two.
    .gt("scheduled_for", todayInParis())
    .select("id, scheduled_for");

  if (error) {
    console.error("[défi commun] annulation impossible", { code: error.code });
    return { message: "L’annulation n’a pas pu être enregistrée." };
  }

  if ((data ?? []).length === 0) {
    return {
      message:
        "Ce défi commun ne peut plus être annulé : sa date est arrivée, ou il l’était déjà.",
    };
  }

  await logAdminAction({
    action: "common_challenge.cancelled",
    targetTable: "common_challenges",
    targetId: id,
    payload: { scheduled_for: data![0]!.scheduled_for },
  });

  revalidatePath("/admin/defis/attribution");
  return { cancelled: true };
}
