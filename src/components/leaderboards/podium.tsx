import { RankBadge } from "@/components/leaderboards/rank-badge";
import { RankMovement } from "@/components/leaderboards/rank-movement";
import { cn } from "@/lib/cn";
import type { CategoryDefinition } from "@/lib/leaderboards/categories";
import { formatValue } from "@/lib/leaderboards/categories";
import type { LeaderboardRow } from "@/lib/leaderboards/read";

/**
 * The provisional podium (story 13.3).
 *
 * **It only appears when it means something**, and that condition is the whole
 * point of this file. A podium on 1 November at six in the morning stages three
 * people who have done nothing more than the others: everybody is on zero, so
 * the order comes from the ranking's tie-break, not from sport. Freezing a
 * hierarchy on that is worse than showing no podium at all.
 *
 * So it needs a real gap: three distinct leaders, a fourth to be ahead of, and
 * a top score above zero.
 *
 * "Provisoire" is written, not implied. A podium looks like a final result, and
 * on a game lasting thirty days that is the wrong impression to give on the 3rd.
 */
export function podiumIsMeaningful(rows: LeaderboardRow[]): boolean {
  if (rows.length < 4) return false;

  const [first, second, third, fourth] = rows;
  if (!first || !second || !third || !fourth) return false;

  // Nobody has scored: the order is arbitrary.
  if (first.value <= 0) return false;

  // A tie spilling past the third place would crown one of several equals.
  if (third.value === fourth.value) return false;

  return true;
}

/** Display order: second, first, third — the shape of a real podium. */
const STEPS = [
  { index: 1, height: "h-16", tint: "bg-[#f1f5f9]" },
  { index: 0, height: "h-24", tint: "bg-[#fef3c7]" },
  { index: 2, height: "h-12", tint: "bg-[#fee8d5]" },
] as const;

export function Podium({
  rows,
  definition,
}: {
  rows: LeaderboardRow[];
  definition: CategoryDefinition;
}) {
  return (
    <section aria-label="Podium provisoire" className="space-y-2">
      <div className="flex items-end justify-center gap-2">
        {STEPS.map((step) => {
          const row = rows[step.index];
          if (!row) return null;

          return (
            <div
              key={row.profileId}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <RankBadge rank={row.rank} />

              <p
                className={cn(
                  "text-ink w-full truncate text-center text-sm font-semibold",
                  row.isSelf && "text-brand-blue",
                )}
              >
                {row.displayName}
              </p>

              <p className="text-ink-muted text-xs tabular-nums">
                {formatValue(row.value, definition.unit)}
              </p>

              <RankMovement movement={row.movement} isNew={row.isNew} />

              <div
                className={cn(
                  "border-line w-full rounded-t-lg border border-b-0",
                  step.height,
                  step.tint,
                )}
              />
            </div>
          );
        })}
      </div>

      <p className="text-ink-muted text-center text-xs">
        Podium provisoire — il reste tout le mois pour en changer.
      </p>
    </section>
  );
}
