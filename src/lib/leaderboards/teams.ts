import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * The team ranking, normalised (story 7.5).
 *
 * **The risk here is social, not technical.** A normalisation people find
 * unfair is worse than no team ranking at all — it turns the one collective
 * feature into an argument. Hence three things: the rule is stated on screen
 * in plain French, the raw total stays visible beside the normalised score,
 * and the formula lives in a database row so it can be corrected in November
 * without a deployment.
 *
 * The formula:
 *
 *     score = total points / (number of members ^ exponent)
 *
 * An exponent of **0** ranks on the raw total: every large team above every
 * small one, which is exactly what the criterion forbids. An exponent of
 * **1** is the plain average: a team of one very keen participant beats fifty
 * committed ones, which is just as unfair the other way. **0.5** sits between
 * the two — a team twice the size needs about 1.4 times the points, not twice
 * and not the same.
 *
 * Aggregated at read time rather than materialised. It is a sum over one row
 * per participant — eight hundred at most — and doing it here is what lets
 * the exponent change and take effect immediately, which is the whole point
 * of putting it in a table.
 */

export type TeamStanding = {
  teamId: string;
  name: string;
  slug: string;
  memberCount: number;
  /** What the team actually did. The figure a company is proud of. */
  points: number;
  challengesSucceeded: number;
  /** Points divided by the normalisation. What decides the rank. */
  score: number;
  rank: number;
  isOwn: boolean;
};

export type TeamLeaderboard = {
  rows: TeamStanding[];
  /** Shown in the interface, because the rule has to be arguable. */
  exponent: number;
  minMembers: number;
  computedAt: string | null;
};

const EMPTY: TeamLeaderboard = {
  rows: [],
  exponent: 0.5,
  minMembers: 2,
  computedAt: null,
};

export async function getTeamLeaderboard(
  ownTeamId: string | null = null,
): Promise<TeamLeaderboard> {
  const supabase = createAnonClient();
  if (!supabase) return EMPTY;

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return EMPTY;

  const [{ data: settings }, { data: entries }, { data: teams }] =
    await Promise.all([
      supabase
        .from("leaderboard_settings")
        .select("team_exponent, team_min_members")
        .maybeSingle(),
      supabase
        .from("leaderboard_entries")
        .select("team_id, points, challenges_succeeded, computed_at")
        .eq("edition_id", edition.id)
        .not("team_id", "is", null),
      supabase
        .from("public_teams")
        .select("id, name, slug")
        .eq("edition_id", edition.id),
    ]);

  const exponent = Number(settings?.team_exponent ?? 0.5);
  const minMembers = Number(settings?.team_min_members ?? 2);

  const totals = new Map<
    string,
    { points: number; challenges: number; members: number }
  >();

  let computedAt: string | null = null;

  for (const entry of entries ?? []) {
    const teamId = entry.team_id;
    if (!teamId) continue;

    computedAt ??= entry.computed_at;

    const current = totals.get(teamId) ?? {
      points: 0,
      challenges: 0,
      members: 0,
    };

    current.points += Number(entry.points ?? 0);
    current.challenges += Number(entry.challenges_succeeded ?? 0);
    current.members += 1;

    totals.set(teamId, current);
  }

  const names = new Map(
    (teams ?? []).map((team) => [
      team.id,
      { name: team.name, slug: team.slug },
    ]),
  );

  const scored = [...totals.entries()]
    // A team of one is a personal ranking wearing a team's name. Excluded
    // rather than penalised, because penalising it invites the argument.
    .filter(([, totals]) => totals.members >= minMembers)
    .map(([teamId, totals]) => ({
      teamId,
      name: names.get(teamId)?.name ?? "Équipe",
      slug: names.get(teamId)?.slug ?? "",
      memberCount: totals.members,
      points: totals.points,
      challengesSucceeded: totals.challenges,
      score: totals.points / Math.pow(totals.members, exponent),
      isOwn: teamId === ownTeamId,
    }))
    .sort((left, right) => right.score - left.score);

  // Equal scores share a place, like the individual rankings. Splitting a tie
  // arbitrarily would make the ranking look unstable every quarter of an hour.
  let previous: number | null = null;
  let rank = 0;

  const rows: TeamStanding[] = scored.map((team, index) => {
    if (previous === null || team.score !== previous) rank = index + 1;
    previous = team.score;

    return { ...team, rank };
  });

  return { rows, exponent, minMembers, computedAt };
}

/**
 * The rule, in a sentence anybody can argue with.
 *
 * Derived from the stored exponent rather than written out, so the sentence
 * cannot drift from the formula when the number is adjusted in November.
 */
export function explainNormalisation(exponent: number): string {
  if (exponent <= 0) {
    return "Les équipes sont classées sur leur total de points, sans correction : les grandes équipes sont donc avantagées.";
  }

  if (exponent >= 1) {
    return "Les équipes sont classées sur leur moyenne de points par membre.";
  }

  // 2^exponent, to the tenth: how many times more points a team twice the
  // size needs in order to stay level.
  const factor = Math.pow(2, exponent).toFixed(1).replace(".", ",");

  return `Les équipes sont classées sur leurs points divisés par leur nombre de membres, atténué. Concrètement : une équipe deux fois plus grande doit marquer environ ${factor} fois plus de points pour rester à égalité — pas deux fois, et pas autant.`;
}
