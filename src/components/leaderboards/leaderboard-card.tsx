import Link from "next/link";

import { RankBadge } from "@/components/leaderboards/rank-badge";
import { RankMovement } from "@/components/leaderboards/rank-movement";
import { cn } from "@/lib/cn";
import type { CategoryDefinition } from "@/lib/leaderboards/categories";
import { formatValue } from "@/lib/leaderboards/categories";
import type { LeaderboardRow } from "@/lib/leaderboards/read";

/**
 * One participant, on their own card (story 13.2).
 *
 * **Compact on purpose: one line tall, not a tile.** The trap of a card format
 * is tripling the height of every row — the fortieth then takes ten swipes to
 * reach, and the screen becomes worse than the list it replaced. The card
 * brings legibility and a touch target, not space.
 *
 * The reader's own card is tinted and says "vous". It is the only line most
 * people are looking for.
 */
export function LeaderboardCard({
  row,
  definition,
  emphasis = false,
}: {
  row: LeaderboardRow;
  definition: CategoryDefinition;
  /** Used for the pinned copy of the reader's own card (story 13.6). */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        row.isSelf || emphasis
          ? "border-brand-blue bg-brand-blue-soft"
          : "border-line bg-surface",
      )}
    >
      <RankBadge rank={row.rank} />

      <div className="min-w-0 flex-1">
        <p className="text-ink truncate font-semibold">
          {row.displayName}
          {row.isSelf && (
            <span className="text-brand-blue font-normal"> — vous</span>
          )}
        </p>
        <RankMovement movement={row.movement} isNew={row.isNew} />
      </div>

      <p className="text-ink shrink-0 font-bold tabular-nums">
        {formatValue(row.value, definition.unit)}
      </p>

      {/* The duel is launched from here, because here is where somebody
          decides they want to challenge a particular person (story 12.3 AC 1).
          A link rather than a form: the next screen shows the three duels, the
          balance and the deadline before anything is spent.

          Absent for the reader's own line and for anybody who has switched
          duels off — offering a button that will always be refused is worse
          than not offering it. */}
      {row.challengeable && (
        <Link
          href={`/jeu/defis-joueurs/envoyer?joueur=${row.profileId}`}
          className="border-line text-brand-blue hover:border-brand-blue flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold"
          aria-label={`Défier ${row.displayName}`}
        >
          Défier
        </Link>
      )}
    </div>
  );
}
