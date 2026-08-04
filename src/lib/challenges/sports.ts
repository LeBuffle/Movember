import { z } from "zod";

/**
 * Sport families.
 *
 * Deliberately coarse. Strava reports dozens of activity types — `Run`,
 * `TrailRun`, `VirtualRun`, `Treadmill` — and a challenge author has no
 * business choosing among them. "Course à pied" covers all four, and the
 * mapping from a provider's vocabulary to these families belongs to the
 * activity layer (epic 3), not to the challenge catalogue.
 *
 * `any` is what makes a fallback challenge possible: something to assign to
 * a participant whose history says nothing yet (architecture D13).
 */
export const SPORT_FAMILIES = [
  "run",
  "bike",
  "swim",
  "strength",
  "walk",
  "any",
] as const;

export type SportFamily = (typeof SPORT_FAMILIES)[number];

/** Shown in the back-office and to participants. */
export const SPORT_FAMILY_LABELS: Record<SportFamily, string> = {
  run: "Course à pied",
  bike: "Vélo",
  swim: "Natation",
  strength: "Renforcement musculaire",
  walk: "Marche",
  any: "Tous sports",
};

export const sportFamilySchema = z.enum(SPORT_FAMILIES, {
  error: "Ce sport n’est pas reconnu.",
});

export const DIFFICULTIES = ["facile", "moyen", "difficile"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: "Facile",
  moyen: "Moyen",
  difficile: "Difficile",
};
