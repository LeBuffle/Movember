import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import {
  categoryOf,
  type LeaderboardCategory,
} from "@/lib/leaderboards/categories";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading the rankings.
 *
 * **Nothing here computes anything.** Every figure and every rank comes
 * straight out of `leaderboard_entries`, recomputed on a schedule (story
 * 7.3). That is what makes eight rankings cost the same as one, and what
 * makes this screen open instantly on a phone.
 *
 * Read with the anonymous client: the rankings are public, they carry no
 * name, and reading them must not depend on a session. Pseudonyms come from
 * `public_profiles` — reading `profiles` for a name would hand over the
 * e-mail addresses in the same query.
 */

export type LeaderboardRow = {
  profileId: string;
  displayName: string;
  rank: number;
  value: number;
  isSelf: boolean;
  /**
   * Places gained since yesterday's photograph (story 13.4).
   *
   * Positive means climbed. **Null means "we do not know"** — no photograph
   * yesterday, or the participant was not ranked then. The screen shows a dash
   * for null, never a zero: a `+0` invented for want of a reference reads as
   * "I have not moved", which is a different statement and a false one.
   */
  movement: number | null;
  /** True when they appear today and did not yesterday. Never a fall. */
  isNew: boolean;
};

export type LeaderboardView = {
  rows: LeaderboardRow[];
  /** The reader's own line, always, even when far down the list. */
  own: LeaderboardRow | null;
  /** How many are ranked at all. */
  total: number;
  computedAt: string | null;
  /**
   * The day the movements are measured from, `YYYY-MM-DD`, or null.
   *
   * **Displayed, not just used.** "+3" without knowing since when is an
   * information the reader completes from imagination, and gets wrong half the
   * time.
   */
  comparedTo: string | null;
};

const EMPTY: LeaderboardView = {
  rows: [],
  own: null,
  total: 0,
  computedAt: null,
  comparedTo: null,
};

async function editionId(): Promise<string | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const { data } = await supabase
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

/** Pseudonyms for a set of identifiers, in one query. */
async function displayNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const supabase = createAnonClient();
  if (!supabase) return new Map();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", ids);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

/**
 * Yesterday's ranks, for the movement column (story 13.4).
 *
 * **The most recent photograph strictly before today**, not "yesterday's date"
 * — a missed run would otherwise silently compare against nothing, and every
 * participant would show a dash for a day. Taking the latest available keeps
 * the column meaningful, and the date is returned so the screen can say which
 * day it is talking about.
 *
 * @returns an empty map when no photograph exists at all, which is the normal
 *   state until the first morning of the game.
 */
async function previousRanks(
  edition: string,
  rankColumn: string,
): Promise<{ ranks: Map<string, number>; takenOn: string | null }> {
  const supabase = createAnonClient();
  if (!supabase) return { ranks: new Map(), takenOn: null };

  const today = new Date().toISOString().slice(0, 10);

  const { data: latest } = await supabase
    .from("leaderboard_snapshots")
    .select("taken_on")
    .eq("edition_id", edition)
    .lt("taken_on", today)
    .order("taken_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const takenOn = latest?.taken_on ?? null;
  if (!takenOn) return { ranks: new Map(), takenOn: null };

  const { data, error } = await supabase
    .from("leaderboard_snapshots")
    .select(`profile_id, ${rankColumn}`)
    .eq("edition_id", edition)
    .eq("taken_on", takenOn);

  if (error) {
    // No movement rather than a wrong one. The screen shows dashes, which is
    // honest, and the ranking itself is unaffected.
    console.error("[classements] photographie illisible", {
      code: error.code,
    });
    return { ranks: new Map(), takenOn: null };
  }

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  return {
    ranks: new Map(
      rows.map((row) => [String(row.profile_id), Number(row[rankColumn])]),
    ),
    takenOn,
  };
}

/**
 * One ranking, its top rows, and the reader's own line.
 *
 * **The own line is fetched separately and always.** Showing only the top
 * fifty would leave the four hundred people below them nothing to come back
 * for — and "vous êtes 143ᵉ" is precisely what gives somebody who will never
 * be first a reason to go out tomorrow (story 7.4 AC 3).
 */
export async function getLeaderboard(
  category: LeaderboardCategory,
  limit = 50,
): Promise<LeaderboardView> {
  const supabase = createAnonClient();
  if (!supabase) return EMPTY;

  const edition = await editionId();
  if (!edition) return EMPTY;

  const definition = categoryOf(category);
  const self = await sessionProfile();

  const [top, mine, counted, previous] = await Promise.all([
    supabase
      .from("leaderboard_entries")
      .select(
        "profile_id, computed_at, points, challenges_succeeded, cards_earned, run_distance_meters, bike_distance_meters, activity_count, total_duration_seconds, rank_points, rank_challenges, rank_cards, rank_run, rank_bike, rank_activities, rank_duration",
      )
      .eq("edition_id", edition)
      .order(definition.rankColumn, { ascending: true })
      .limit(limit),
    self
      ? supabase
          .from("leaderboard_entries")
          .select(
            "profile_id, points, challenges_succeeded, cards_earned, run_distance_meters, bike_distance_meters, activity_count, total_duration_seconds, rank_points, rank_challenges, rank_cards, rank_run, rank_bike, rank_activities, rank_duration",
          )
          .eq("edition_id", edition)
          .eq("profile_id", self)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("leaderboard_entries")
      .select("profile_id", { count: "exact", head: true })
      .eq("edition_id", edition),
    previousRanks(edition, definition.rankColumn),
  ]);

  const rows = (top.data ?? []) as unknown as Array<Record<string, unknown>>;
  const ownRow = (mine.data ?? null) as Record<string, unknown> | null;

  const ids = rows.map((row) => String(row.profile_id));
  if (ownRow) ids.push(String(ownRow.profile_id));

  const names = await displayNames([...new Set(ids)]);

  const toRow = (row: Record<string, unknown>): LeaderboardRow =>
    buildRow(row, definition, names, self, previous);

  return {
    rows: rows.map(toRow),
    own: ownRow ? toRow(ownRow) : null,
    total: counted.count ?? 0,
    computedAt: rows[0] ? String(rows[0].computed_at ?? "") || null : null,
    comparedTo: previous.takenOn,
  };
}

/**
 * One row of the ranking, movement included.
 *
 * Shared by the ranking and the search so the two can never disagree about
 * what a rank or a movement is.
 */
function buildRow(
  row: Record<string, unknown>,
  definition: ReturnType<typeof categoryOf>,
  names: Map<string, string>,
  self: string | null,
  previous: { ranks: Map<string, number>; takenOn: string | null },
): LeaderboardRow {
  const profileId = String(row.profile_id);
  const rank = Number(row[definition.rankColumn] ?? 0);
  const before = previous.ranks.get(profileId);

  /* Three distinct cases, and conflating any two of them produces a figure
     that is quietly wrong:

     - no photograph at all      → unknown, a dash
     - photograph without them   → new, never "fell by 340 places"
     - photograph with them      → a real movement

     A rank going DOWN in number is a climb, hence the subtraction in this
     order. */
  const movement =
    previous.takenOn === null || before === undefined ? null : before - rank;

  return {
    profileId,
    displayName: names.get(profileId) ?? "Participant",
    rank,
    value: Number(row[definition.column] ?? 0),
    isSelf: profileId === self,
    movement,
    isNew: previous.takenOn !== null && before === undefined,
  };
}

/**
 * Finding one player by pseudonym, anywhere in the ranking (story 13.5).
 *
 * **The difference between a search and a filter decides this story.** A filter
 * applied to the fifty rows already on screen answers "aucun résultat" for
 * somebody ranked 342nd — who exists, and is visible two pages further down.
 * That is the defect everybody ships by accident, and that nobody notices while
 * testing with twenty accounts.
 *
 * So the search starts from `public_profiles`, over the whole edition, and then
 * reads those participants' ranks. It returns their **real rank**, not their
 * position among the results.
 *
 * @returns an empty list for a blank query — not every row. A search box that
 *   dumps the whole ranking on an accidental keystroke is a search box people
 *   stop using.
 */
export async function searchLeaderboard(
  category: LeaderboardCategory,
  query: string,
  limit = 20,
): Promise<LeaderboardRow[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const supabase = createAnonClient();
  if (!supabase) return [];

  const edition = await editionId();
  if (!edition) return [];

  const definition = categoryOf(category);

  /* Neutralised before it reaches PostgREST: a comma or a parenthesis in a
     pseudonym would otherwise be read as filter syntax rather than as text.
     Same treatment as the back-office search of story 8.2. */
  const safe = term.replace(/[,()*%]/g, " ").trim();
  if (safe.length < 2) return [];

  const { data: matches, error } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .ilike("display_name", `%${safe}%`)
    .limit(limit);

  if (error) {
    console.error("[classements] recherche impossible", { code: error.code });
    return [];
  }

  const found = matches ?? [];
  if (found.length === 0) return [];

  const [ranked, previous, self] = await Promise.all([
    supabase
      .from("leaderboard_entries")
      .select(
        "profile_id, points, challenges_succeeded, cards_earned, run_distance_meters, bike_distance_meters, activity_count, total_duration_seconds, rank_points, rank_challenges, rank_cards, rank_run, rank_bike, rank_activities, rank_duration",
      )
      .eq("edition_id", edition)
      .in(
        "profile_id",
        found.map((row) => row.id),
      ),
    previousRanks(edition, definition.rankColumn),
    sessionProfile(),
  ]);

  const names = new Map(found.map((row) => [row.id, row.display_name]));

  const rows = (ranked.data ?? []) as unknown as Array<Record<string, unknown>>;

  return rows
    .map((row) => buildRow(row, definition, names, self, previous))
    .sort((left, right) => left.rank - right.rank);
}

export type OwnStanding = {
  points: number;
  challengesSucceeded: number;
  cardsEarned: number;
  runDistanceMeters: number;
  bikeDistanceMeters: number;
  activityCount: number;
  totalDurationSeconds: number;
  ranks: Record<LeaderboardCategory, number>;
  computedAt: string | null;
};

/**
 * Everything about the reader, for their dashboard (story 7.6).
 *
 * @returns `null` when they are not ranked at all — which happens before the
 *   first refresh and for a registration that is not active. The screen turns
 *   that into encouragement rather than an empty page.
 */
export async function ownStanding(): Promise<OwnStanding | null> {
  const self = await sessionProfile();
  if (!self) return null;

  const supabase = createAnonClient();
  if (!supabase) return null;

  const edition = await editionId();
  if (!edition) return null;

  const { data } = await supabase
    .from("leaderboard_entries")
    .select(
      "points, challenges_succeeded, cards_earned, run_distance_meters, bike_distance_meters, activity_count, total_duration_seconds, rank_points, rank_challenges, rank_cards, rank_run, rank_bike, rank_activities, rank_duration, computed_at",
    )
    .eq("edition_id", edition)
    .eq("profile_id", self)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as Record<string, number | string>;

  return {
    points: Number(row.points),
    challengesSucceeded: Number(row.challenges_succeeded),
    cardsEarned: Number(row.cards_earned),
    runDistanceMeters: Number(row.run_distance_meters),
    bikeDistanceMeters: Number(row.bike_distance_meters),
    activityCount: Number(row.activity_count),
    totalDurationSeconds: Number(row.total_duration_seconds),
    ranks: {
      points: Number(row.rank_points),
      challenges: Number(row.rank_challenges),
      cards: Number(row.rank_cards),
      run: Number(row.rank_run),
      bike: Number(row.rank_bike),
      activities: Number(row.rank_activities),
      duration: Number(row.rank_duration),
    },
    computedAt: String(row.computed_at ?? "") || null,
  };
}
