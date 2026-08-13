import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { notify } from "@/lib/notifications/dispatch";
import { buildPayload } from "@/lib/notifications/payload";
import { removeLogoObject } from "@/lib/super-teams/logo-storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Looking at what was uploaded, after the fact (story 14.6).
 *
 * **Moderation here is a posteriori, and it is a decision rather than a
 * shortcut** (epic 14, decision S3). Approving every logo before it appears
 * would land on three volunteers at the exact moment registrations arrive in
 * bulk, and a team without its badge for three days is a team that gives up
 * on the idea.
 *
 * The risk that follows — an unsuitable picture visible until somebody looks
 * — is bounded by three things, and this file carries two of them: removal in
 * one gesture, and a trace of who uploaded what. The third already exists:
 * the participant suspension of story 8.7, for the serious case.
 */

export type LogoOwnerKind = "equipe" | "super-equipe";

export type LogoEntry = {
  kind: LogoOwnerKind;
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  uploadedByName: string | null;
  uploadedAt: string | null;
  /** Null while the logo is still waiting in the queue. */
  reviewedAt: string | null;
};

async function editionId(): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Every logo of the edition, unreviewed ones first.
 *
 * **The order is the feature.** A flat list of every logo is a list you
 * re-read in full every day, and therefore stop reading on the third. What
 * has not been looked at comes first; what has, sinks — which is what turns a
 * watch into a two-minute daily task with an end.
 */
export async function listLogos(): Promise<LogoEntry[]> {
  const edition = await editionId();
  if (!edition) return [];

  const admin = createAdminClient();

  const [{ data: teams }, { data: superTeams }] = await Promise.all([
    admin
      .from("teams")
      .select(
        "id, name, slug, logo_url, logo_uploaded_by, logo_uploaded_at, logo_reviewed_at",
      )
      .eq("edition_id", edition)
      .not("logo_url", "is", null),
    admin
      .from("super_teams")
      .select(
        "id, name, slug, logo_url, logo_uploaded_by, logo_uploaded_at, logo_reviewed_at",
      )
      .eq("edition_id", edition)
      .not("logo_url", "is", null),
  ]);

  const rows = [
    ...(teams ?? []).map((row) => ({ kind: "equipe" as const, ...row })),
    ...(superTeams ?? []).map((row) => ({
      kind: "super-equipe" as const,
      ...row,
    })),
  ];

  if (rows.length === 0) return [];

  const uploaderIds = [
    ...new Set(
      rows
        .map((row) => row.logo_uploaded_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: uploaders } = uploaderIds.length
    ? await admin
        .from("public_profiles")
        .select("id, display_name")
        .in("id", uploaderIds)
    : { data: [] };

  const names = new Map(
    (uploaders ?? []).map((row) => [row.id, row.display_name]),
  );

  return rows
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url!,
      uploadedByName: row.logo_uploaded_by
        ? (names.get(row.logo_uploaded_by) ?? "Participant")
        : null,
      uploadedAt: row.logo_uploaded_at,
      reviewedAt: row.logo_reviewed_at,
    }))
    .sort((left, right) => {
      // Unreviewed first, then most recently uploaded.
      if (!left.reviewedAt && right.reviewedAt) return -1;
      if (left.reviewedAt && !right.reviewedAt) return 1;

      return (right.uploadedAt ?? "").localeCompare(left.uploadedAt ?? "");
    });
}

export type ModerationOutcome =
  { ok: true } | { ok: false; reason: "not-found" | "failed" };

const TABLES = {
  equipe: "teams",
  "super-equipe": "super_teams",
} as const;

/** Marks a logo as looked at, so it leaves the queue. */
export async function markLogoReviewed(
  kind: LogoOwnerKind,
  id: string,
): Promise<ModerationOutcome> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from(TABLES[kind])
    .update({ logo_reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[logos] relecture non enregistrée", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  if ((data ?? []).length === 0) return { ok: false, reason: "not-found" };

  return { ok: true };
}

/**
 * Taking a logo down.
 *
 * **The captain is told, and not as a sanction.** A silent removal reads as a
 * fault in the application, and the captain re-uploads the same file. The
 * message says the logo was removed and that another one may be uploaded —
 * which is also true: a removal is not a block.
 *
 * The row is cleared before the object is swept, and the notification comes
 * last. A notification that fails must never leave a picture on screen.
 */
export async function removeLogoAsAdmin(
  kind: LogoOwnerKind,
  id: string,
): Promise<ModerationOutcome> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from(TABLES[kind])
    .select("id, name, logo_url, captain_id")
    .eq("id", id)
    .maybeSingle();

  if (!row?.logo_url) return { ok: false, reason: "not-found" };

  const { error } = await admin
    .from(TABLES[kind])
    .update({
      logo_url: null,
      logo_uploaded_by: null,
      logo_uploaded_at: null,
      logo_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[logos] retrait impossible", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  await removeLogoObject(row.logo_url);

  if (row.captain_id) {
    await notify({
      profileIds: [row.captain_id],
      category: "annonce",
      payload: buildPayload({
        title: "Logo retiré",
        body: `Le logo de ${row.name} a été retiré par l’organisation. Vous pouvez en envoyer un autre.`,
        url: kind === "equipe" ? "/jeu/equipe" : "/jeu/super-equipe",
      }),
      // The moment is part of the key: a second removal, later, is a second
      // message rather than one silently swallowed as a duplicate.
      dedupeKey: `logo-retire:${id}:${Date.now()}`,
    });
  }

  return { ok: true };
}
