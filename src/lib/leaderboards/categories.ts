/**
 * The eight rankings, described once.
 *
 * Pure and apart from every query, because the screens are partly client
 * components and because this is the list that decides what exists. Adding a
 * ninth ranking is an entry here plus a column in the view — which is exactly
 * the point of computing them all in one pass (architecture D14).
 *
 * **Why seven individual rankings rather than one.** At 600 participants, a
 * single ranking interests the first ten. Seven categories give everybody
 * somewhere to appear honourably — the cyclist, the regular, the collector,
 * the one who simply goes out often. The technical cost is marginal; the
 * effect on whether somebody comes back on day nine is not.
 */

export type LeaderboardCategory =
  | "points"
  | "challenges"
  | "cards"
  | "run"
  | "bike"
  | "activities"
  | "duration";

export type CategoryDefinition = {
  key: LeaderboardCategory;
  /** Shown as the tab. Short — these sit side by side on a phone. */
  label: string;
  /** One sentence under the title, saying what is being counted. */
  description: string;
  /** Column of `leaderboard_entries` holding the figure. */
  column: string;
  /** Column holding the rank, precomputed by the view. */
  rankColumn: string;
  /** How the figure reads. */
  unit: "points" | "count" | "metres" | "seconds";
};

export const CATEGORIES: CategoryDefinition[] = [
  {
    key: "points",
    label: "Général",
    description:
      "Les points des défis réussis. C’est le classement principal, et il ne tient compte d’aucune carte.",
    column: "points",
    rankColumn: "rank_points",
    unit: "points",
  },
  {
    key: "challenges",
    label: "Défis réussis",
    description: "Le nombre de défis validés, quelle que soit leur difficulté.",
    column: "challenges_succeeded",
    rankColumn: "rank_challenges",
    unit: "count",
  },
  {
    key: "cards",
    label: "Cartes gagnées",
    description:
      "Uniquement les cartes obtenues en jouant. Celles des packs n’y figurent jamais.",
    column: "cards_earned",
    rankColumn: "rank_cards",
    unit: "count",
  },
  {
    key: "run",
    label: "Course",
    description: "Les kilomètres parcourus en course à pied.",
    column: "run_distance_meters",
    rankColumn: "rank_run",
    unit: "metres",
  },
  {
    key: "bike",
    label: "Vélo",
    description: "Les kilomètres parcourus à vélo.",
    column: "bike_distance_meters",
    rankColumn: "rank_bike",
    unit: "metres",
  },
  {
    key: "activities",
    label: "Sorties",
    description: "Le nombre d’activités enregistrées, tous sports confondus.",
    column: "activity_count",
    rankColumn: "rank_activities",
    unit: "count",
  },
  {
    key: "duration",
    label: "Temps",
    description: "Le temps passé à bouger, tous sports confondus.",
    column: "total_duration_seconds",
    rankColumn: "rank_duration",
    unit: "seconds",
  },
];

export function isCategory(value: string): value is LeaderboardCategory {
  return CATEGORIES.some((entry) => entry.key === value);
}

export function categoryOf(key: LeaderboardCategory): CategoryDefinition {
  return CATEGORIES.find((entry) => entry.key === key)!;
}

/**
 * A figure, in the words somebody would use.
 *
 * Metres become kilometres and seconds become hours, because nobody says "I
 * did 12 400 metres". Rounded to one decimal below a hundred and to the unit
 * above: `4,2 km` is precise, `142,7 km` is noise.
 */
export function formatValue(value: number, unit: CategoryDefinition["unit"]) {
  switch (unit) {
    case "points":
      return `${value} point${value > 1 ? "s" : ""}`;

    case "count":
      return String(value);

    case "metres": {
      const km = value / 1000;
      return `${round(km)} km`;
    }

    case "seconds": {
      const hours = value / 3600;

      // Below an hour, hours read as "0,3 h" and mean nothing. Minutes do.
      if (hours < 1) return `${Math.round(value / 60)} min`;

      return `${round(hours)} h`;
    }
  }
}

function round(value: number): string {
  const rounded = value < 100 ? Math.round(value * 10) / 10 : Math.round(value);

  return rounded.toLocaleString("fr-FR");
}
