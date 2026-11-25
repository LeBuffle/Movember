import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { removeLogoObject, uploadLogo } from "@/lib/super-teams/logo-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Who may change what a team or a federation looks like (stories 14.4, 14.5).
 *
 * **The split between appearance and composition is what makes the super
 * team captain's role bearable.** Appearance comes undone in one click; a
 * detachment does not — it takes a team's internal ranking away in the middle
 * of November without telling anybody. So the first is delegated and the
 * second stays with the organisation.
 *
 * Every guard is established here, from the session, and carried by the write
 * itself. Row level security cannot express "you captain the team this row
 * belongs to", and it certainly cannot express "you may write these two
 * columns and not that third one" — which is exactly what a super team
 * captain is allowed to do.
 */

export type AppearanceOutcome =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "not-captain" | "failed" }
  | { ok: false; reason: "bad-file"; message: string };

async function sessionProfile(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

/**
 * The edition every lookup here is scoped to.
 *
 * Not decoration: a captain of the 2026 edition may also captain the 2027
 * one, and an unscoped `maybeSingle()` would then fail rather than pick.
 */
async function editionId(): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  return data?.id ?? null;
}

/* -------------------------------------------------------------------------
 * A team's logo — story 14.4
 * ---------------------------------------------------------------------- */

/**
 * Replacing the badge of the team the caller captains.
 *
 * The team is found from the session, never from the form: a posted team
 * identifier is whatever the sender chose to write, and "captain of the team
 * you say" is not a rule.
 */
export async function setOwnTeamLogo(file: File): Promise<AppearanceOutcome> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const edition = await editionId();
  if (!edition) return { ok: false, reason: "failed" };

  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, logo_url")
    .eq("captain_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!team) return { ok: false, reason: "not-captain" };

  const uploaded = await uploadLogo(file);
  if (!uploaded.ok) {
    return { ok: false, reason: "bad-file", message: uploaded.message };
  }

  const previous = team.logo_url;

  const { error } = await admin
    .from("teams")
    .update({
      logo_url: uploaded.url,
      logo_uploaded_by: profileId,
      logo_uploaded_at: new Date().toISOString(),
      // A reviewed team is not a reviewed picture. Clearing this is what puts
      // the new logo back at the top of the moderation queue (story 14.6).
      logo_reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", team.id)
    // Carried by the write: the captaincy could have been handed over
    // between the read above and this line.
    .eq("captain_id", profileId);

  if (error) {
    console.error("[logos] logo d’équipe non enregistré", { code: error.code });
    await removeLogoObject(uploaded.url);
    return { ok: false, reason: "failed" };
  }

  if (previous) await removeLogoObject(previous);

  return { ok: true };
}

export async function clearOwnTeamLogo(): Promise<AppearanceOutcome> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const edition = await editionId();
  if (!edition) return { ok: false, reason: "failed" };

  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, logo_url")
    .eq("captain_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!team) return { ok: false, reason: "not-captain" };
  if (!team.logo_url) return { ok: true };

  const { error } = await admin
    .from("teams")
    .update({
      logo_url: null,
      logo_uploaded_by: null,
      logo_uploaded_at: null,
      logo_reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", team.id)
    .eq("captain_id", profileId);

  if (error) {
    console.error("[logos] logo d’équipe non retiré", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  await removeLogoObject(team.logo_url);

  return { ok: true };
}

/* -------------------------------------------------------------------------
 * A federation's appearance — story 14.5
 * ---------------------------------------------------------------------- */

export type CaptainedSuperTeam = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
};

/**
 * The federation the caller captains, if any.
 *
 * @returns `null` for everybody else — which is what makes the appearance
 *   screen unreachable by typing its address, rather than merely unlinked.
 */
export async function captainedSuperTeam(): Promise<CaptainedSuperTeam | null> {
  const profileId = await sessionProfile();
  if (!profileId) return null;

  const edition = await editionId();
  if (!edition) return null;

  const admin = createAdminClient();

  const { data } = await admin
    .from("super_teams")
    .select("id, name, slug, description, logo_url")
    .eq("captain_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    logoUrl: data.logo_url,
  };
}

export const MAX_SUPER_TEAM_DESCRIPTION = 1000;

export type AppearanceChange = {
  description: string;
  /** Absent when the captain only edited the text. */
  file?: File | null;
  removeLogo?: boolean;
};

/**
 * The two things a super team captain may change, and nothing else.
 *
 * The update names its columns one by one rather than spreading an object
 * built from the form. That is the whole guard: `name`, `slug` and
 * `captain_id` are not writable here because they are not written here, and
 * no amount of extra form fields changes that.
 */
export async function setSuperTeamAppearance(
  change: AppearanceChange,
): Promise<AppearanceOutcome> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const own = await captainedSuperTeam();
  if (!own) return { ok: false, reason: "not-captain" };

  const description = change.description.trim();

  if (description.length > MAX_SUPER_TEAM_DESCRIPTION) {
    return {
      ok: false,
      reason: "bad-file",
      message: `La description ne peut pas dépasser ${MAX_SUPER_TEAM_DESCRIPTION} caractères.`,
    };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const update: {
    description: string;
    updated_at: string;
    logo_url?: string | null;
    logo_uploaded_by?: string | null;
    logo_uploaded_at?: string | null;
    logo_reviewed_at?: string | null;
  } = { description, updated_at: now };

  let uploadedUrl: string | null = null;

  if (change.file && change.file.size > 0) {
    const uploaded = await uploadLogo(change.file);

    if (!uploaded.ok) {
      return { ok: false, reason: "bad-file", message: uploaded.message };
    }

    uploadedUrl = uploaded.url;
    update.logo_url = uploaded.url;
    update.logo_uploaded_by = profileId;
    update.logo_uploaded_at = now;
    update.logo_reviewed_at = null;
  } else if (change.removeLogo) {
    update.logo_url = null;
    update.logo_uploaded_by = null;
    update.logo_uploaded_at = null;
    update.logo_reviewed_at = null;
  }

  const { error } = await admin
    .from("super_teams")
    .update(update)
    .eq("id", own.id)
    // Carried by the write: the organisation could have named somebody else
    // between the read above and this line.
    .eq("captain_id", profileId);

  if (error) {
    console.error("[logos] apparence de super-équipe non enregistrée", {
      code: error.code,
    });

    if (uploadedUrl) await removeLogoObject(uploadedUrl);
    return { ok: false, reason: "failed" };
  }

  if (own.logoUrl && (uploadedUrl || change.removeLogo)) {
    await removeLogoObject(own.logoUrl);
  }

  return { ok: true };
}
