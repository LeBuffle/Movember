import "server-only";

import { generateJoinCode, normaliseJoinCode, slugify } from "@/lib/teams/code";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Creating a team, and joining one.
 *
 * **Written with the service key, and the reason is specific.** Neither
 * `teams` nor `team_members` carries a write policy, because row level
 * security can check "this row is yours" and cannot check "you knew the join
 * code". A policy allowing a participant to insert their own membership would
 * let anybody walk into any team by identifier alone — the captain's control
 * would be decorative, and the team ranking open to whoever fancied sitting
 * in the leading team.
 *
 * So the code is verified here, and the identity is taken from the session
 * and never from a parameter.
 */

export type TeamKind = "libre" | "entreprise" | "association";

export const TEAM_KINDS: Array<{ value: TeamKind; label: string }> = [
  { value: "libre", label: "Équipe libre" },
  { value: "entreprise", label: "Entreprise" },
  { value: "association", label: "Association ou club" },
];

export function isTeamKind(value: string): value is TeamKind {
  return TEAM_KINDS.some((entry) => entry.value === value);
}

export type OwnTeam = {
  id: string;
  name: string;
  slug: string;
  kind: TeamKind;
  /** Only ever filled in for the captain. */
  joinCode: string | null;
  isCaptain: boolean;
  memberCount: number;
};

async function currentEdition(): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  return data?.id ?? null;
}

async function sessionProfile(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export type CreateOutcome =
  | { ok: true; teamId: string }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "already-in-team"
        | "name-taken"
        | "bad-name"
        | "failed";
    };

/**
 * Creating a team makes you its captain, in one step.
 *
 * A team with no captain is a team the organisation has to adopt by hand in
 * November, so the two facts are written together — the row and the
 * membership — and the membership carries the `capitaine` role from the
 * start.
 */
export async function createTeam(
  name: string,
  kind: TeamKind,
): Promise<CreateOutcome> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const edition = await currentEdition();
  if (!edition) return { ok: false, reason: "failed" };

  const slug = slugify(name);
  if (!slug) return { ok: false, reason: "bad-name" };

  const admin = createAdminClient();

  // Checked before creating a team rather than after: a team created and then
  // abandoned because its creator was already elsewhere would sit in every
  // list with nobody in it.
  const { data: existing } = await admin
    .from("team_members")
    .select("id")
    .eq("profile_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (existing) return { ok: false, reason: "already-in-team" };

  const { data: team, error } = await admin
    .from("teams")
    .insert({
      edition_id: edition,
      name: name.trim(),
      slug,
      join_code: generateJoinCode(),
      captain_id: profileId,
      kind,
    })
    .select("id")
    .maybeSingle();

  if (error || !team) {
    // The database decides, not a look-up a moment earlier: two people
    // creating "Les Moustachus" at the same second both pass a prior check
    // and only one passes the index.
    if (error?.code === "23505") return { ok: false, reason: "name-taken" };

    console.error("[équipes] création impossible", { code: error?.code });
    return { ok: false, reason: "failed" };
  }

  const { error: memberError } = await admin.from("team_members").insert({
    team_id: team.id,
    profile_id: profileId,
    edition_id: edition,
    role: "capitaine",
  });

  if (memberError) {
    // The team exists but its captain is not in it. Removed rather than left
    // behind: an empty team in every list is worse than a failed creation the
    // participant can simply retry.
    await admin.from("teams").delete().eq("id", team.id);

    console.error("[équipes] capitaine non enregistré", {
      code: memberError.code,
    });
    return { ok: false, reason: "failed" };
  }

  return { ok: true, teamId: team.id };
}

export type JoinOutcome =
  | { ok: true; teamId: string; teamName: string; alreadyMember: boolean }
  | {
      ok: false;
      reason: "unauthenticated" | "unknown-code" | "already-in-team" | "failed";
    };

/**
 * Joining with a code.
 *
 * The code is the only proof required, and it is checked here because nothing
 * else can check it. An unknown code gets a sentence, never an error page:
 * the most likely explanation is a character misread, and the participant
 * should be invited to try again rather than told something went wrong.
 */
export async function joinTeam(rawCode: string): Promise<JoinOutcome> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const code = normaliseJoinCode(rawCode);
  if (!code) return { ok: false, reason: "unknown-code" };

  const edition = await currentEdition();
  if (!edition) return { ok: false, reason: "failed" };

  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, name")
    .eq("join_code", code)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!team) return { ok: false, reason: "unknown-code" };

  const { error } = await admin.from("team_members").insert({
    team_id: team.id,
    profile_id: profileId,
    edition_id: edition,
    role: "membre",
  });

  if (error) {
    // The unique index on (profile_id, edition_id) is what answers here, and
    // its answer covers two cases that read very differently to the
    // participant: already in *this* team, or already in another one.
    if (error.code === "23505") {
      const { data: current } = await admin
        .from("team_members")
        .select("team_id")
        .eq("profile_id", profileId)
        .eq("edition_id", edition)
        .maybeSingle();

      if (current?.team_id === team.id) {
        return {
          ok: true,
          teamId: team.id,
          teamName: team.name,
          alreadyMember: true,
        };
      }

      return { ok: false, reason: "already-in-team" };
    }

    console.error("[équipes] adhésion impossible", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  return {
    ok: true,
    teamId: team.id,
    teamName: team.name,
    alreadyMember: false,
  };
}

/**
 * The participant's team, if they have one.
 *
 * The join code is included **only when the reader is the captain**. It is
 * the secret that makes a team joinable, and reading it is what the whole
 * `public_teams` view exists to prevent for everybody else.
 */
export async function ownTeam(): Promise<OwnTeam | null> {
  const profileId = await sessionProfile();
  if (!profileId) return null;

  const edition = await currentEdition();
  if (!edition) return null;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("team_members")
    .select("team_id, role")
    .eq("profile_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!membership) return null;

  const [{ data: team }, { count }] = await Promise.all([
    admin
      .from("teams")
      .select("id, name, slug, kind, join_code, captain_id")
      .eq("id", membership.team_id)
      .maybeSingle(),
    admin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", membership.team_id),
  ]);

  if (!team) return null;

  const isCaptain = team.captain_id === profileId;

  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    kind: team.kind as TeamKind,
    joinCode: isCaptain ? team.join_code : null,
    isCaptain,
    memberCount: count ?? 0,
  };
}
