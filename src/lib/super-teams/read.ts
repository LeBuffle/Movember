import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import {
  explainNormalisation,
  getTeamLeaderboard,
  type TeamLeaderboard,
} from "@/lib/leaderboards/teams";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * A federation as a participant reads it (story 14.3).
 *
 * **One ranking is added and none is modified.** The internal standings come
 * out of `getTeamLeaderboard` with the federation's teams passed in — the
 * same normalisation, the same stored exponent, the same member threshold,
 * the same tie handling. A second formula would be a second argument about
 * fairness, and two rules in one application are two rules nobody can
 * explain.
 *
 * Read through `public_super_teams` and `public_teams`, like everything else
 * a participant may see. Neither carries a join code, and neither names the
 * captain.
 */

export type SuperTeamPage = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  /** The federation's own totals, summed from its teams. */
  points: number;
  challengesSucceeded: number;
  memberCount: number;
  teamCount: number;
  /** Its teams, ranked between themselves. Ranks start again at 1. */
  standings: TeamLeaderboard;
  /** The sentence that makes the rule arguable. */
  normalisation: string;
};

export async function getSuperTeamPage(
  slug: string,
  ownTeamId: string | null = null,
): Promise<SuperTeamPage | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return null;

  const { data: superTeam } = await supabase
    .from("public_super_teams")
    .select("id, name, slug, description, logo_url")
    .eq("edition_id", edition.id)
    .eq("slug", slug)
    .maybeSingle();

  if (!superTeam) return null;

  const { data: teams } = await supabase
    .from("public_teams")
    .select("id")
    .eq("edition_id", edition.id)
    .eq("super_team_id", superTeam.id);

  const teamIds = (teams ?? []).map((team) => team.id);

  // A federation with nothing attached is a legitimate state — it is how one
  // looks between its creation and its first attachment — so it renders an
  // empty ranking rather than a missing page.
  const standings = await getTeamLeaderboard(ownTeamId, { teamIds });

  const points = standings.rows.reduce((sum, row) => sum + row.points, 0);
  const challenges = standings.rows.reduce(
    (sum, row) => sum + row.challengesSucceeded,
    0,
  );
  const members = standings.rows.reduce((sum, row) => sum + row.memberCount, 0);

  return {
    id: superTeam.id,
    name: superTeam.name,
    slug: superTeam.slug,
    description: superTeam.description,
    logoUrl: superTeam.logo_url,
    points,
    challengesSucceeded: challenges,
    memberCount: members,
    teamCount: teamIds.length,
    standings,
    normalisation: explainNormalisation(standings.exponent),
  };
}

export type TeamFederation = { name: string; slug: string };

/**
 * The federation a team belongs to, if any.
 *
 * Used by the team page to offer the one link that matters to a branch: the
 * ranking it is actually being compared in.
 */
export async function federationOfTeam(
  superTeamId: string | null,
): Promise<TeamFederation | null> {
  if (!superTeamId) return null;

  const supabase = createAnonClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("public_super_teams")
    .select("name, slug")
    .eq("id", superTeamId)
    .maybeSingle();

  return data ? { name: data.name, slug: data.slug } : null;
}
