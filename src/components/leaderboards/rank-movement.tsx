import { cn } from "@/lib/cn";

/**
 * How many places somebody has gained or lost (story 13.4).
 *
 * **Three states, and conflating any two produces a quiet lie.**
 *
 * - `null` — no reference. Shows a dash. A `+0` invented for want of a
 *   photograph reads as "I have not moved", which is a different claim, and a
 *   false one.
 * - `isNew` — appears today, did not yesterday. Shows "nouveau", never
 *   "−340 places": somebody who joined on 5 November has not fallen.
 * - a number — a real movement.
 *
 * The direction is carried by an arrow and a sign, never by colour alone.
 */
export function RankMovement({
  movement,
  isNew,
  className,
}: {
  movement: number | null;
  isNew: boolean;
  className?: string;
}) {
  if (isNew) {
    return (
      <span
        className={cn(
          "text-brand-blue text-xs font-semibold whitespace-nowrap",
          className,
        )}
      >
        nouveau
      </span>
    );
  }

  if (movement === null) {
    return (
      <span
        className={cn("text-ink-muted text-xs", className)}
        title="Pas de repère pour ce jour"
      >
        —
      </span>
    );
  }

  if (movement === 0) {
    return (
      <span
        className={cn("text-ink-muted text-xs whitespace-nowrap", className)}
        aria-label="Position inchangée depuis hier"
      >
        = 0
      </span>
    );
  }

  const climbed = movement > 0;
  const places = Math.abs(movement);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap",
        climbed ? "text-success" : "text-danger",
        className,
      )}
      aria-label={`${climbed ? "Gagné" : "Perdu"} ${places} place${places > 1 ? "s" : ""} depuis hier`}
    >
      <Arrow up={climbed} />
      <span aria-hidden="true">
        {climbed ? "+" : "−"}
        {places}
      </span>
    </span>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {up ? (
        <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
      ) : (
        <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />
      )}
    </svg>
  );
}
