import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import {
  CATEGORIES,
  formatValue,
  type LeaderboardCategory,
} from "@/lib/leaderboards/categories";
import { ownStanding } from "@/lib/leaderboards/read";

export const metadata = {
  title: "Mon tableau de bord — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The screen somebody shows a colleague.
 *
 * **Totals alone are not enough: the rank is what gives the figure meaning.**
 * "142 km" is a number; "142 km, 7ᵉ au vélo" is a story. So every line
 * carries both, and they come from the same materialised view — nothing here
 * computes anything (story 7.3).
 *
 * The participant who has done nothing yet is the most important case on this
 * page, and the one worth writing carefully: they are the one who can still
 * be convinced.
 */
export default async function DashboardPage() {
  const standing = await ownStanding();

  const values: Record<LeaderboardCategory, number> = standing
    ? {
        points: standing.points,
        challenges: standing.challengesSucceeded,
        cards: standing.cardsEarned,
        run: standing.runDistanceMeters,
        bike: standing.bikeDistanceMeters,
        activities: standing.activityCount,
        duration: standing.totalDurationSeconds,
      }
    : {
        points: 0,
        challenges: 0,
        cards: 0,
        run: 0,
        bike: 0,
        activities: 0,
        duration: 0,
      };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/jeu" className="underline underline-offset-4">
            Le jeu
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Mon tableau de bord
        </h1>
      </div>

      {!standing ? (
        <>
          <Alert tone="info" title="Vos chiffres arrivent">
            Ils apparaîtront ici dès votre première sortie enregistrée. Rien
            n’est cassé : il n’y a simplement encore rien à compter.
          </Alert>

          <p>
            <Link href="/jeu" className={buttonClasses()}>
              Voir mon défi du jour
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((category) => (
              <div
                key={category.key}
                className="border-line bg-surface rounded-xl border p-4"
              >
                <p className="text-ink-muted text-sm">{category.label}</p>

                <p className="text-brand-orange-ink mt-1 text-2xl font-extrabold">
                  {formatValue(values[category.key], category.unit)}
                </p>

                {/* The rank, next to the figure rather than on another
                    screen. It is what turns a total into a position. */}
                <p className="text-ink-muted mt-1 text-sm">
                  <Link
                    href={`/jeu/classement?categorie=${category.key}`}
                    className="underline underline-offset-4"
                  >
                    {ordinal(standing.ranks[category.key])} au classement
                  </Link>
                </p>
              </div>
            ))}
          </div>

          <p className="text-ink-muted text-sm">
            Calculé le{" "}
            {standing.computedAt
              ? new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Europe/Paris",
                }).format(new Date(standing.computedAt))
              : "—"}
            . Les chiffres sont recalculés toutes les quinze minutes.
          </p>
        </>
      )}
    </div>
  );
}

/** `1` → `1ᵉʳ`, everything else → `Nᵉ`. */
function ordinal(rank: number): string {
  if (rank <= 0) return "Non classé";

  return rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`;
}
