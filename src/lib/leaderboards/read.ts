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
};

export type LeaderboardView = {
  rows: LeaderboardRow[];
  /** The reader's own line, always, even when far down the list. */
  own: LeaderboardRow | null;
  /** How many are ranked at all. */
  total: number;
  computedAt: string | null;
};

const EMPTY: LeaderboardView = {
  rows: [],
  own: null,
  total: 0,
  computedAt: null,
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

  const [top, mine, counted] = await Promise.all([
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
  ]);

  const rows = (top.data ?? []) as unknown as Array<Record<string, unknown>>;
  const ownRow = (mine.data ?? null) as Record<string, unknown> | null;

  const ids = rows.map((row) => String(row.profile_id));
  if (ownRow) ids.push(String(ownRow.profile_id));

  const names = await displayNames([...new Set(ids)]);

  const toRow = (row: Record<string, unknown>): LeaderboardRow => ({
    profileId: String(row.profile_id),
    displayName: names.get(String(row.profile_id)) ?? "Participant",
    rank: Number(row[definition.rankColumn] ?? 0),
    value: Number(row[definition.column] ?? 0),
    isSelf: String(row.profile_id) === self,
  });

  return {
    rows: rows.map(toRow),
    own: ownRow ? toRow(ownRow) : null,
    total: counted.count ?? 0,
    computedAt: rows[0] ? String(rows[0].computed_at ?? "") || null : null,
  };
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
