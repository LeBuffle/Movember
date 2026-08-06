import { SPORT_FAMILY_LABELS, type SportFamily } from "@/lib/challenges/sports";

/**
 * Says a challenge's settings out loud, in French.
 *
 * **This is the safety net story 4.1 could not provide.** Bounds catch a
 * threshold that is too large; nothing catches one that is too small. Someone
 * typing 5 while thinking kilometres produces a valid configuration and a
 * challenge everybody completes without moving. What catches it is reading
 * "Parcourir 5 m" and knowing that is not what was meant.
 *
 * So the preview is not decoration. It is the last check before a challenge
 * goes into the catalogue, and it must describe what the machine understood
 * — never what the volunteer probably meant.
 *
 * Also used outside the back-office, from story 4.6: what is shown to a
 * participant should be the same sentence the author validated.
 */

/** Groups thousands so that 30000 reads as 30 000. */
function group(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${group(meters)} m`;

  const km = Number((meters / 1000).toFixed(2));

  // Comma, not point. "5.5 km" is how a machine writes it; a French reader
  // sees a thousands separator and reads five thousand five hundred.
  return `${group(Math.trunc(km))}${decimals(km)} km`;
}

/** The fractional part, French-style, or nothing at all. */
function decimals(value: number): string {
  const fraction = Math.abs(value) % 1;

  return fraction === 0
    ? ""
    : `,${String(Number(fraction.toFixed(2))).slice(2)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  const hourPart = hours === 1 ? "1 heure" : `${hours} heures`;

  return minutes === 0 ? hourPart : `${hourPart} et ${minutes} minutes`;
}

/**
 * Names the sports accepted.
 *
 * A separate sentence rather than a clause: "en course à pied" and "à vélo"
 * do not take the same preposition, and a description that has to be
 * grammatically correct in French for every combination of six families is a
 * description that will be wrong somewhere.
 */
export function describeSports(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const families = value.filter(
    (family): family is SportFamily => family in SPORT_FAMILY_LABELS,
  );

  if (families.length === 0) return null;
  if (families.includes("any")) return "Tous les sports comptent.";

  const labels = families.map((family) =>
    SPORT_FAMILY_LABELS[family].toLocaleLowerCase("fr-FR"),
  );

  return `Sports acceptés : ${labels.join(", ")}.`;
}

function windowSuffix(value: unknown): string {
  return value === "multi_day" ? "sur plusieurs jours" : "dans la journée";
}

/**
 * One outing, or several added up.
 *
 * Always said, in both directions. The setting decides whether two 2,5 km
 * walks are worth a 5 km challenge — which is the difference between a
 * challenge somebody can fit into their day and one they cannot — so leaving
 * it implicit would let an author publish the opposite of what they meant.
 */
function effortSuffix(value: unknown): string {
  return value === "cumulative"
    ? ", en cumulant les sorties"
    : ", en une seule sortie";
}

function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one;
}

const COLLECTIVE_METRICS: Record<string, (target: number) => { what: string }> =
  {
    distance_meters: (target) => ({ what: formatDistance(target) }),
    duration_seconds: (target) => ({ what: formatDuration(target) }),
    activity_count: (target) => ({
      what: `${group(target)} ${plural(target, "activité", "activités")}`,
    }),
  };

/**
 * @param config a configuration already validated by `parseChallengeConfig`.
 *   Values are read defensively anyway: this is also called on rows read from
 *   the database, and a sentence saying nothing is better than a crash in the
 *   middle of the back-office.
 * @returns one short sentence per line.
 */
export function describeChallenge(
  evaluator: string,
  config: Record<string, unknown>,
): string[] {
  const number = (key: string): number | null =>
    typeof config[key] === "number" ? (config[key] as number) : null;

  const sports = describeSports(config.sport_types);
  const withSports = (lines: string[]) => (sports ? [...lines, sports] : lines);

  switch (evaluator) {
    case "distance": {
      const meters = number("min_distance_meters");
      if (meters === null) break;

      return withSports([
        `Parcourir ${formatDistance(meters)} ${windowSuffix(config.window)}${effortSuffix(config.effort)}.`,
      ]);
    }

    case "duration": {
      const seconds = number("min_duration_seconds");
      if (seconds === null) break;

      return withSports([
        `Bouger pendant ${formatDuration(seconds)} ${windowSuffix(config.window)}${effortSuffix(config.effort)}.`,
      ]);
    }

    case "elevation": {
      const meters = number("min_elevation_meters");
      if (meters === null) break;

      return withSports([
        `Cumuler ${group(meters)} m de dénivelé positif ${windowSuffix(config.window)}${effortSuffix(config.effort)}.`,
      ]);
    }

    case "streak": {
      const days = number("days");
      if (days === null) break;

      const lines = [
        `Bouger ${days} ${plural(days, "jour", "jours")} de suite.`,
      ];

      const gaps = number("allowed_gaps") ?? 0;
      if (gaps > 0) {
        lines.push(
          `${gaps} ${plural(gaps, "jour", "jours")} de tolérance ${plural(gaps, "est accordé", "sont accordés")}.`,
        );
      }

      const perDay = number("min_duration_seconds_per_day");
      if (perDay !== null) {
        lines.push(`Au moins ${formatDuration(perDay)} par jour.`);
      }

      return withSports(lines);
    }

    case "multisport": {
      const distinct = number("distinct_sports");
      if (distinct === null) break;

      const days = number("window_days") ?? 1;
      const when =
        days <= 1 ? "dans la journée" : `sur une fenêtre de ${days} jours`;

      return withSports([`Pratiquer ${distinct} sports différents ${when}.`]);
    }

    case "collective": {
      const target = number("target");
      const metric = COLLECTIVE_METRICS[String(config.metric)];
      if (target === null || !metric) break;

      return withSports([
        `Ensemble, tous participants confondus : ${metric(target).what}.`,
      ]);
    }

    case "surprise": {
      const conditions = Array.isArray(config.conditions)
        ? config.conditions
        : [];
      if (conditions.length === 0) break;

      const intro =
        config.mode === "any"
          ? `Réussir une seule des ${conditions.length} conditions suivantes.`
          : `Réussir les ${conditions.length} conditions suivantes.`;

      const detail = conditions.map((condition, index) => {
        const { evaluator: key, config: inner } = (condition ?? {}) as {
          evaluator?: unknown;
          config?: unknown;
        };

        const described =
          typeof key === "string" && inner && typeof inner === "object"
            ? describeChallenge(key, inner as Record<string, unknown>)
            : [];

        return `${index + 1}. ${described.join(" ") || "Condition incomplète."}`;
      });

      return [intro, ...detail];
    }
  }

  // Reached when a setting is missing. Says so rather than inventing a
  // sentence — a preview that lies is worse than no preview.
  return [
    "Réglages incomplets : la description apparaîtra une fois le défi valide.",
  ];
}
