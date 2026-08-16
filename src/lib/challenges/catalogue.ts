import {
  isEvaluatorKey,
  type EvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import {
  DIFFICULTIES,
  SPORT_FAMILIES,
  type Difficulty,
  type SportFamily,
} from "@/lib/challenges/sports";

/**
 * How big the catalogue has to be, and how the back-office says so.
 *
 * **The floor is arithmetic, not an opinion.** November has thirty days, a
 * participant is drawn one challenge a day, and the database refuses to draw
 * the same challenge twice for the same person (story 4.1). Below thirty
 * active challenges the month cannot be filled at all — the daily task simply
 * runs out, on a date nobody can predict from looking at the screen.
 *
 * At exactly thirty it technically works and is still bad: everyone receives
 * the same thirty challenges in a different order, and withdrawing a single
 * one breaks the month. Sixty is where variety starts, and it is the figure
 * the brief already carried (60 to 80).
 *
 * This is the main risk of the whole epic: a thin catalogue produces
 * repetition, and nobody notices until participants do.
 */
export const CATALOGUE_MINIMUM = 30;
export const CATALOGUE_TARGET = 60;

export type CatalogueHealth = {
  tone: "danger" | "warning" | "success";
  title: string;
  message: string;
};

export function catalogueHealth(active: number): CatalogueHealth {
  if (active < CATALOGUE_MINIMUM) {
    return {
      tone: "danger",
      title: `${active} défis actifs sur ${CATALOGUE_MINIMUM} nécessaires`,
      message:
        `Novembre compte 30 jours et personne ne reçoit deux fois le même défi : ` +
        `en dessous de ${CATALOGUE_MINIMUM} défis actifs, le mois ne peut pas être rempli. ` +
        `Il en manque ${CATALOGUE_MINIMUM - active}.`,
    };
  }

  if (active < CATALOGUE_TARGET) {
    return {
      tone: "warning",
      title: `${active} défis actifs — l’objectif est ${CATALOGUE_TARGET}`,
      message:
        `Le mois peut être rempli, mais tout le monde recevra presque les mêmes défis, ` +
        `et en retirer un suffirait à repasser sous le seuil. Visez ${CATALOGUE_TARGET} à 80.`,
    };
  }

  return {
    tone: "success",
    title: `${active} défis actifs`,
    message:
      "Le catalogue est assez fourni pour que deux participants vivent des mois différents.",
  };
}

/* -------------------------------------------------------------------------
 * Filters
 *
 * Read from the address bar rather than from component state: the back-office
 * is used from a phone, and a filtered list that survives a back button — and
 * that can be sent to someone else as a link — is worth more than an
 * interaction that looks smoother.
 * ---------------------------------------------------------------------- */

export type CatalogueFilters = {
  search: string;
  sport: SportFamily | null;
  difficulty: Difficulty | null;
  evaluator: EvaluatorKey | null;
  /** `all` shows withdrawn challenges alongside the active ones. */
  status: "active" | "inactive" | "all";
};

function pick<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : null;
}

export function parseCatalogueFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogueFilters {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const evaluator = single("type");

  return {
    // Trimmed and capped: this string goes into a `like` pattern, and an
    // unbounded one is a needlessly expensive query to hand a stranger.
    search: (single("q") ?? "").trim().slice(0, 80),
    sport: pick(single("sport"), SPORT_FAMILIES),
    difficulty: pick(single("difficulte"), DIFFICULTIES),
    evaluator:
      typeof evaluator === "string" && isEvaluatorKey(evaluator)
        ? evaluator
        : null,
    status:
      pick(single("etat"), ["active", "inactive", "all"] as const) ?? "active",
  };
}

/** Whether anything is filtered, so the screen can offer to clear it. */
export function hasActiveFilters(filters: CatalogueFilters): boolean {
  return (
    filters.search !== "" ||
    filters.sport !== null ||
    filters.difficulty !== null ||
    filters.evaluator !== null ||
    filters.status !== "active"
  );
}

/**
 * Escapes a search term for a Postgres `ilike` pattern.
 *
 * Without this, typing `%` matches everything and `_` matches anything —
 * confusing rather than dangerous, but the kind of confusion that gets
 * reported as "la recherche ne marche pas".
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}
