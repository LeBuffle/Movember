import { cn } from "@/lib/cn";

/**
 * The rank, and a medal for the first three (story 13.3).
 *
 * **The medal carries its rank in words, not only in colour.** Gold, silver
 * and bronze are three close shades for a share of readers — and this game is
 * aimed first at men, eight percent of whom distinguish some colours poorly.
 * The number stays, the medal is added; a reader who sees neither colour still
 * reads "1".
 */

const MEDALS: Record<number, { label: string; classes: string }> = {
  1: {
    label: "Médaille d’or",
    classes: "bg-[#fef3c7] text-[#92400e] border-[#d97706]",
  },
  2: {
    label: "Médaille d’argent",
    classes: "bg-[#f1f5f9] text-[#475569] border-[#94a3b8]",
  },
  3: {
    label: "Médaille de bronze",
    classes: "bg-[#fee8d5] text-[#9a3412] border-[#c2410c]",
  },
};

export function RankBadge({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  const medal = MEDALS[rank];

  if (!medal) {
    return (
      <span
        className={cn(
          "text-ink-muted min-w-9 text-right text-sm font-semibold tabular-nums",
          className,
        )}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      // The medal is decoration; the accessible name says what it means.
      title={medal.label}
      aria-label={`${rank}ᵉ — ${medal.label}`}
      className={cn(
        "inline-flex min-w-9 items-center justify-center gap-1 rounded-full border px-2 py-0.5",
        "text-sm font-bold tabular-nums",
        medal.classes,
        className,
      )}
    >
      <MedalIcon />
      <span aria-hidden="true">{rank}</span>
    </span>
  );
}

/** Inline, like every other icon here: nothing to load, nothing blocked. */
function MedalIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="10" r="4.2" />
      <path d="M5.5 6 3.5 1.5M10.5 6l2-4.5" strokeLinecap="round" />
    </svg>
  );
}
