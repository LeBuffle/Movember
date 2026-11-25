import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { slugify } from "@/lib/teams/code";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Running the federations, from the organisation's side (story 14.2).
 *
 * **Everything here is the organisation's, and none of it is the captain's.**
 * Creating a super team, attaching a team, detaching one, naming a captain:
 * four gestures reserved to the back-office by decision, not by accident. The
 * super team's own captain gets the appearance screen of story 14.5 and
 * nothing else — detaching a team in the middle of November takes away its
 * internal ranking without warning anybody, and that is not a mistake a
 * volunteer should be able to make on someone else's behalf.
 *
 * Written with the service key for the same reason as `teams/manage.ts`: row
 * level security can check "this row is yours", it cannot check "you are an
 * administrator acting on a team you do not belong to". The admin role is
 * established by the action that calls in, and every guard that matters is
 * carried by the write itself.
 */

export type SuperTeamOutcome =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "name-taken"
        | "bad-name"
        | "not-found"
        | "already-attached"
        | "not-a-member"
        | "failed";
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

export type AdminSuperTeam = {
  id: string;
  name: string;
  slug: string;
  description: string;
  captainId: string | null;
  captainName: string | null;
  teamCount: number;
  memberCount: number;
};

/** Every federation of the edition, with what it actually holds. */
export async function listSuperTeams(): Promise<AdminSuperTeam[]> {
  const edition = await editionId();
  if (!edition) return [];

  const admin = createAdminClient();

  const { data: superTeams, error } = await admin
    .from("super_teams")
    .select("id, name, slug, description, captain_id")
    .eq("edition_id", edition)
    .order("name");

  if (error) {
    console.error("[super-équipes] liste illisible", { code: error.code });
    return [];
  }

  const rows = superTeams ?? [];
  if (rows.length === 0) return [];

  const { data: teams } = await admin
    .from("teams")
    .select("id, super_team_id")
    .eq("edition_id", edition)
    .not("super_team_id", "is", null);

  const { data: members } = await admin
    .from("team_members")
    .select("team_id")
    .eq("edition_id", edition);

  const captainIds = rows
    .map((row) => row.captain_id)
    .filter((id): id is string => Boolean(id));

  const { data: captains } = captainIds.length
    ? await admin
        .from("public_profiles")
        .select("id, display_name")
        .in("id", captainIds)
    : { data: [] };

  const superTeamOfTeam = new Map(
    (teams ?? []).map((team) => [team.id, team.super_team_id]),
  );

  const teamCounts = new Map<string, number>();
  for (const superTeamId of superTeamOfTeam.values()) {
    if (!superTeamId) continue;
    teamCounts.set(superTeamId, (teamCounts.get(superTeamId) ?? 0) + 1);
  }

  const memberCounts = new Map<string, number>();
  for (const member of members ?? []) {
    const superTeamId = superTeamOfTeam.get(member.team_id);
    if (!superTeamId) continue;
    memberCounts.set(superTeamId, (memberCounts.get(superTeamId) ?? 0) + 1);
  }

  const names = new Map(
    (captains ?? []).map((row) => [row.id, row.display_name]),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    captainId: row.captain_id,
    captainName: row.captain_id
      ? (names.get(row.captain_id) ?? "Participant")
      : null,
    teamCount: teamCounts.get(row.id) ?? 0,
    memberCount: memberCounts.get(row.id) ?? 0,
  }));
}

export type CreateSuperTeamOutcome =
  | { ok: true; superTeamId: string }
  | { ok: false; reason: "name-taken" | "bad-name" | "failed" };

export async function createSuperTeam(
  name: string,
  description: string,
): Promise<CreateSuperTeamOutcome> {
  const edition = await editionId();
  if (!edition) return { ok: false, reason: "failed" };

  const slug = slugify(name);
  if (!slug) return { ok: false, reason: "bad-name" };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("super_teams")
    .insert({
      edition_id: edition,
      name: name.trim(),
      slug,
      description: description.trim(),
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, reason: "name-taken" };

    console.error("[super-équipes] création impossible", { code: error?.code });
    return { ok: false, reason: "failed" };
  }

  return { ok: true, superTeamId: data.id };
}

/**
 * Renaming.
 *
 * **The slug follows the name, and that is a trade-off worth naming.** The
 * old address stops working, so a link shared in a federation's own group
 * chat breaks. The alternative — a slug frozen at creation — leaves
 * `/super-equipe/table-rond` in the address bar after a typo is fixed, and
 * that is the version somebody screenshots. Renaming is an administrator's
 * gesture made a handful of times, almost always in October.
 */
export async function renameSuperTeam(
  superTeamId: string,
  name: string,
): Promise<SuperTeamOutcome> {
  const slug = slugify(name);
  if (!slug) return { ok: false, reason: "bad-name" };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("super_teams")
    .update({ name: name.trim(), slug, updated_at: new Date().toISOString() })
    .eq("id", superTeamId)
    .select("id");

  if (error) {
    if (error.code === "23505") return { ok: false, reason: "name-taken" };

    console.error("[super-équipes] renommage impossible", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  if ((data ?? []).length === 0) return { ok: false, reason: "not-found" };

  return { ok: true };
}

/**
 * Deleting a federation.
 *
 * The teams are detached by the foreign key, not by a loop here — `on delete
 * set null` in the migration. One less place for the rule "no team is ever
 * deleted with its super team" to be forgotten.
 */
export async function deleteSuperTeam(
  superTeamId: string,
): Promise<SuperTeamOutcome> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("super_teams")
    .delete()
    .eq("id", superTeamId)
    .select("id");

  if (error) {
    console.error("[super-équipes] suppression impossible", {
      code: error.code,
    });
    return { ok: false, reason: "failed" };
  }

  if ((data ?? []).length === 0) return { ok: false, reason: "not-found" };

  return { ok: true };
}

/**
 * Attaching a team.
 *
 * **The guard is carried by the write.** `.is("super_team_id", null)` is what
 * makes "one super team per team" true even when two administrators are on
 * the screen at the same time — a check made a moment earlier would not be.
 * Zero rows back means the team was attached in between, which is exactly
 * what the caller needs to be told.
 */
export async function attachTeam(
  superTeamId: string,
  teamId: string,
): Promise<SuperTeamOutcome> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teams")
    .update({
      super_team_id: superTeamId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId)
    .is("super_team_id", null)
    .select("id");

  if (error) {
    console.error("[super-équipes] rattachement impossible", {
      code: error.code,
    });
    return { ok: false, reason: "failed" };
  }

  if ((data ?? []).length === 0) {
    return { ok: false, reason: "already-attached" };
  }

  return { ok: true };
}

/**
 * Detaching a team.
 *
 * Takes away its internal ranking and nothing else: its members, its points
 * and its place in the general ranking are untouched, because none of them
 * has ever been stored on the super team.
 *
 * If the detached team's captain was the federation's captain, the captaincy
 * is cleared with it — otherwise a federation would keep an appearance
 * manager who no longer belongs to any of its teams.
 */
export async function detachTeam(teamId: string): Promise<SuperTeamOutcome> {
  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, super_team_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team?.super_team_id) return { ok: false, reason: "not-found" };

  const { error } = await admin
    .from("teams")
    .update({ super_team_id: null, updated_at: new Date().toISOString() })
    .eq("id", teamId)
    .eq("super_team_id", team.super_team_id);

  if (error) {
    console.error("[super-équipes] détachement impossible", {
      code: error.code,
    });
    return { ok: false, reason: "failed" };
  }

  await clearCaptainIfOutside(team.super_team_id);

  return { ok: true };
}

/**
 * Naming the captain.
 *
 * **Only somebody who is in one of the federation's teams.** Naming an
 * outsider is a typing mistake rather than an intention, and the restricted
 * list on screen is the first guard — this one is the second, because a form
 * field is whatever was posted.
 */
export async function assignSuperCaptain(
  superTeamId: string,
  profileId: string,
): Promise<SuperTeamOutcome> {
  const admin = createAdminClient();

  const members = await superTeamMembers(superTeamId);
  if (!members.some((member) => member.profileId === profileId)) {
    return { ok: false, reason: "not-a-member" };
  }

  const { data, error } = await admin
    .from("super_teams")
    .update({ captain_id: profileId, updated_at: new Date().toISOString() })
    .eq("id", superTeamId)
    .select("id");

  if (error) {
    console.error("[super-équipes] capitaine non désigné", {
      code: error.code,
    });
    return { ok: false, reason: "failed" };
  }

  if ((data ?? []).length === 0) return { ok: false, reason: "not-found" };

  return { ok: true };
}

export type SuperTeamMember = {
  profileId: string;
  displayName: string;
  teamName: string;
};

/**
 * Everybody in a federation, by pseudonym and by team.
 *
 * The team name travels with the person because two participants in a
 * hundred-strong federation will share a first name, and "Sylvain (Table de
 * Barran)" is choosable where "Sylvain" is a coin toss.
 */
export async function superTeamMembers(
  superTeamId: string,
): Promise<SuperTeamMember[]> {
  const admin = createAdminClient();

  const { data: teams } = await admin
    .from("teams")
    .select("id, name")
    .eq("super_team_id", superTeamId);

  const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));
  if (teamNames.size === 0) return [];

  const { data: members } = await admin
    .from("team_members")
    .select("profile_id, team_id")
    .in("team_id", [...teamNames.keys()]);

  const rows = members ?? [];
  if (rows.length === 0) return [];

  const { data: names } = await admin
    .from("public_profiles")
    .select("id, display_name")
    .in(
      "id",
      rows.map((row) => row.profile_id),
    );

  const byId = new Map((names ?? []).map((row) => [row.id, row.display_name]));

  return rows
    .map((row) => ({
      profileId: row.profile_id,
      displayName: byId.get(row.profile_id) ?? "Participant",
      teamName: teamNames.get(row.team_id) ?? "",
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

/**
 * Drops a captain who no longer belongs to the federation.
 *
 * Runs after a detachment. Silent when there is nothing to do, and silent on
 * failure: a stale captaincy is a nuisance an administrator can fix, while a
 * detachment refused because of it is a detachment done by hand in the
 * database.
 */
async function clearCaptainIfOutside(superTeamId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: superTeam } = await admin
    .from("super_teams")
    .select("captain_id")
    .eq("id", superTeamId)
    .maybeSingle();

  if (!superTeam?.captain_id) return;

  const members = await superTeamMembers(superTeamId);
  if (members.some((member) => member.profileId === superTeam.captain_id)) {
    return;
  }

  await admin
    .from("super_teams")
    .update({ captain_id: null, updated_at: new Date().toISOString() })
    .eq("id", superTeamId);
}

export type AttachableTeam = { id: string; name: string; memberCount: number };

/**
 * The teams an administrator may still attach.
 *
 * Only the unattached ones. Showing every team and refusing on submit would
 * be the same rule expressed as a failure — and a list of eighty teams where
 * a third of them cannot be chosen is a list nobody trusts.
 */
export async function attachableTeams(): Promise<AttachableTeam[]> {
  const edition = await editionId();
  if (!edition) return [];

  const admin = createAdminClient();

  const { data: teams, error } = await admin
    .from("teams")
    .select("id, name")
    .eq("edition_id", edition)
    .is("super_team_id", null)
    .order("name");

  if (error) {
    console.error("[super-équipes] équipes libres illisibles", {
      code: error.code,
    });
    return [];
  }

  const rows = teams ?? [];
  if (rows.length === 0) return [];

  const { data: members } = await admin
    .from("team_members")
    .select("team_id")
    .eq("edition_id", edition);

  const counts = new Map<string, number>();
  for (const member of members ?? []) {
    counts.set(member.team_id, (counts.get(member.team_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    memberCount: counts.get(row.id) ?? 0,
  }));
}

export type AttachedTeam = { id: string; name: string; slug: string };

/** The teams a federation currently holds, for the back-office list. */
export async function attachedTeams(
  superTeamId: string,
): Promise<AttachedTeam[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teams")
    .select("id, name, slug")
    .eq("super_team_id", superTeamId)
    .order("name");

  if (error) {
    console.error("[super-équipes] équipes rattachées illisibles", {
      code: error.code,
    });
    return [];
  }

  return data ?? [];
}
