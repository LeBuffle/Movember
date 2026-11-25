import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { generateJoinCode, slugify } from "@/lib/teams/code";
import type { TeamKind } from "@/lib/teams/kinds";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Running a team once it exists.
 *
 * **The captain does the work the organisation cannot do in their place**:
 * they know the people and know how to convince them. Everything that forces
 * them to write to the organisation is recruitment lost — which is why
 * leaving, excluding and handing over are all here rather than in a support
 * mailbox.
 *
 * Written with the service key for the same reason as `membership.ts`: row
 * level security can check "this row is yours", it cannot check "you are the
 * captain of the team this row belongs to". So each function establishes that
 * itself, from the session, and the checks are carried by the writes.
 */

export type TeamMember = {
  profileId: string;
  displayName: string;
  role: "capitaine" | "membre";
  joinedAt: string;
  isSelf: boolean;
};

async function sessionProfile(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

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
 * Who is in a team, by pseudonym.
 *
 * The names come from `public_profiles` — the one sanctioned way to read
 * another participant. Reading `profiles` to get a name would hand over the
 * e-mail addresses in the same query.
 */
export async function teamMembers(teamId: string): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const self = await sessionProfile();

  const { data: rows, error } = await admin
    .from("team_members")
    .select("profile_id, role, joined_at")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });

  if (error) {
    console.error("[équipes] membres illisibles", { code: error.code });
    return [];
  }

  const members = rows ?? [];
  if (members.length === 0) return [];

  const { data: names } = await admin
    .from("public_profiles")
    .select("id, display_name")
    .in(
      "id",
      members.map((member) => member.profile_id),
    );

  const byId = new Map((names ?? []).map((row) => [row.id, row.display_name]));

  return members.map((member) => ({
    profileId: member.profile_id,
    // A deleted account leaves its membership behind for a moment. Named
    // rather than blank, so the count on screen matches the list under it.
    displayName: byId.get(member.profile_id) ?? "Participant",
    role: member.role,
    joinedAt: member.joined_at,
    isSelf: member.profile_id === self,
  }));
}

export type ManageOutcome =
  | { ok: true; note?: "team-dissolved" }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "not-in-team"
        | "not-captain"
        | "captain-must-hand-over"
        | "not-a-member"
        | "failed";
    };

/**
 * Leaving.
 *
 * **A captain with members cannot simply walk out** (AC 5). A team with no
 * captain is a team nobody can invite into, nobody can administer, and that
 * the organisation ends up repairing by hand in November.
 *
 * A captain who is *alone* is a different case entirely, and refusing them
 * would be absurd: their team is dissolved with them. Nothing is lost —
 * challenges, points and cards belong to the participant, never to the team.
 */
export async function leaveTeam(): Promise<ManageOutcome> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const edition = await editionId();
  if (!edition) return { ok: false, reason: "failed" };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("team_members")
    .select("id, team_id, role")
    .eq("profile_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!membership) return { ok: false, reason: "not-in-team" };

  const { count } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", membership.team_id);

  const alone = (count ?? 0) <= 1;

  if (membership.role === "capitaine" && !alone) {
    return { ok: false, reason: "captain-must-hand-over" };
  }

  const { error } = await admin
    .from("team_members")
    .delete()
    .eq("id", membership.id)
    // Carried by the write: somebody could have been handed the captaincy
    // between the read above and this line.
    .eq("profile_id", profileId);

  if (error) {
    console.error("[équipes] départ impossible", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  if (alone) {
    // The last member out turns off the light. An empty team would sit in
    // every list and every ranking with nothing behind it.
    await admin.from("teams").delete().eq("id", membership.team_id);
    return { ok: true, note: "team-dissolved" };
  }

  return { ok: true };
}

/** Establishes that the caller captains a team, and says which. */
async function requireCaptain(): Promise<
  { ok: true; teamId: string; profileId: string } | ManageOutcome
> {
  const profileId = await sessionProfile();
  if (!profileId) return { ok: false, reason: "unauthenticated" };

  const edition = await editionId();
  if (!edition) return { ok: false, reason: "failed" };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("team_members")
    .select("team_id, role")
    .eq("profile_id", profileId)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!membership) return { ok: false, reason: "not-in-team" };
  if (membership.role !== "capitaine") {
    return { ok: false, reason: "not-captain" };
  }

  return { ok: true, teamId: membership.team_id, profileId };
}

/**
 * Excluding a member.
 *
 * The captain's call, and only theirs. A captain cannot exclude themselves —
 * that is leaving, and leaving has its own rule about handing over.
 */
export async function removeMember(
  memberProfileId: string,
): Promise<ManageOutcome> {
  const captain = await requireCaptain();
  if (!("teamId" in captain)) return captain;

  if (memberProfileId === captain.profileId) {
    return { ok: false, reason: "captain-must-hand-over" };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("team_members")
    .delete()
    .eq("team_id", captain.teamId)
    .eq("profile_id", memberProfileId)
    // Never the captain, whatever was posted. The guard is on the write, not
    // on a check made a moment earlier.
    .eq("role", "membre")
    .select("id");

  if (error) {
    console.error("[équipes] exclusion impossible", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  if ((data ?? []).length === 0) return { ok: false, reason: "not-a-member" };

  return { ok: true };
}

/**
 * Handing the captaincy over.
 *
 * Two writes that have to agree — the team's `captain_id` and the two
 * membership roles — and they are done in that order deliberately. If the
 * second fails, the team briefly has a captain whose membership still says
 * "membre": awkward, and recoverable by trying again. The other order would
 * leave a team with two captains, which nothing recovers from.
 */
export async function handOverCaptaincy(
  memberProfileId: string,
): Promise<ManageOutcome> {
  const captain = await requireCaptain();
  if (!("teamId" in captain)) return captain;

  if (memberProfileId === captain.profileId) return { ok: true };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", captain.teamId)
    .eq("profile_id", memberProfileId)
    .maybeSingle();

  if (!member) return { ok: false, reason: "not-a-member" };

  const { error } = await admin
    .from("teams")
    .update({
      captain_id: memberProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", captain.teamId)
    // Only the current captain hands over, and the write says so itself.
    .eq("captain_id", captain.profileId);

  if (error) {
    console.error("[équipes] transmission impossible", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  await admin
    .from("team_members")
    .update({ role: "capitaine" })
    .eq("id", member.id);

  await admin
    .from("team_members")
    .update({ role: "membre" })
    .eq("team_id", captain.teamId)
    .eq("profile_id", captain.profileId);

  return { ok: true };
}

export type AdminTeam = {
  id: string;
  name: string;
  kind: TeamKind;
  joinCode: string;
  memberCount: number;
  captainName: string;
};

/** Every team of the edition, for the back-office. */
export async function listTeams(): Promise<AdminTeam[]> {
  const edition = await editionId();
  if (!edition) return [];

  const admin = createAdminClient();

  const { data: teams, error } = await admin
    .from("teams")
    .select("id, name, kind, join_code, captain_id")
    .eq("edition_id", edition)
    .order("name");

  if (error) {
    console.error("[équipes] liste illisible", { code: error.code });
    return [];
  }

  const rows = teams ?? [];
  if (rows.length === 0) return [];

  const [{ data: members }, { data: captains }] = await Promise.all([
    admin.from("team_members").select("team_id").eq("edition_id", edition),
    admin
      .from("public_profiles")
      .select("id, display_name")
      .in(
        "id",
        rows.map((row) => row.captain_id),
      ),
  ]);

  const counts = new Map<string, number>();
  for (const member of members ?? []) {
    counts.set(member.team_id, (counts.get(member.team_id) ?? 0) + 1);
  }

  const names = new Map(
    (captains ?? []).map((row) => [row.id, row.display_name]),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as TeamKind,
    joinCode: row.join_code,
    memberCount: counts.get(row.id) ?? 0,
    captainName: names.get(row.captain_id) ?? "Participant",
  }));
}

export type AdminCreateOutcome =
  | { ok: true; teamId: string; joinCode: string }
  | { ok: false; reason: "name-taken" | "bad-name" | "failed" };

/**
 * A team created by the organisation, for a company or an association
 * (FR78).
 *
 * **It has no captain among the participants yet**, and that is the whole
 * point: a company asks for a team before anybody has registered. The
 * administrator becomes its captain on paper, hands the code to the company's
 * contact, and passes the captaincy on once that person has an account.
 */
export async function adminCreateTeam(
  name: string,
  kind: TeamKind,
  captainId: string,
): Promise<AdminCreateOutcome> {
  const edition = await editionId();
  if (!edition) return { ok: false, reason: "failed" };

  const slug = slugify(name);
  if (!slug) return { ok: false, reason: "bad-name" };

  const admin = createAdminClient();
  const joinCode = generateJoinCode();

  const { data: team, error } = await admin
    .from("teams")
    .insert({
      edition_id: edition,
      name: name.trim(),
      slug,
      join_code: joinCode,
      captain_id: captainId,
      kind,
    })
    .select("id")
    .maybeSingle();

  if (error || !team) {
    if (error?.code === "23505") return { ok: false, reason: "name-taken" };

    console.error("[équipes] création administrative impossible", {
      code: error?.code,
    });
    return { ok: false, reason: "failed" };
  }

  return { ok: true, teamId: team.id, joinCode };
}

/**
 * Handing a team over to the person who will actually run it.
 *
 * The counterpart of `adminCreateTeam`, and the reason it exists. A team
 * created for a company is captained on paper by an administrator until the
 * company's contact has an account; this is how it stops being.
 *
 * Separate from `handOverCaptaincy` on purpose: that one requires the caller
 * to be the captain *as a member*, which an administrator holding a team for
 * a company deliberately is not. The caller's admin role is checked by the
 * action that calls this.
 */
export async function adminAssignCaptain(
  teamId: string,
  memberProfileId: string,
): Promise<ManageOutcome> {
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("profile_id", memberProfileId)
    .maybeSingle();

  // Only somebody already in the team. A captain who is not a member could
  // not be excluded, could not leave, and would not count in the ranking.
  if (!member) return { ok: false, reason: "not-a-member" };

  const { error } = await admin
    .from("teams")
    .update({
      captain_id: memberProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teamId);

  if (error) {
    console.error("[équipes] capitaine non désigné", { code: error.code });
    return { ok: false, reason: "failed" };
  }

  await admin
    .from("team_members")
    .update({ role: "membre" })
    .eq("team_id", teamId)
    .eq("role", "capitaine");

  await admin
    .from("team_members")
    .update({ role: "capitaine" })
    .eq("id", member.id);

  return { ok: true };
}
