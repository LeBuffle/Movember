import Link from "next/link";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  CATEGORIES,
  categoryOf,
  formatValue,
  isCategory,
  type LeaderboardCategory,
} from "@/lib/leaderboards/categories";
import { getLeaderboard } from "@/lib/leaderboards/read";
import {
  explainNormalisation,
  getTeamLeaderboard,
} from "@/lib/leaderboards/teams";
import { ownTeam } from "@/lib/teams/membership";

export const metadata = {
  title: "Classements — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where somebody finds out where they stand.
 *
 * **Your own line is always there, wherever you are in the list.** Showing
 * only the top fifty would leave four hundred people nothing to come back
 * for; "vous êtes 143ᵉ" is what gives a reason to go out tomorrow to somebody
 * who will never be first (AC 3).
 *
 * The categories live in the address bar rather than in component state: a
 * ranking can be sent to a teammate as a link, and the back button works.
 *
 * Everything shown comes out of the materialised view. Nothing on this page
 * computes a ranking — that is the whole point of story 7.3.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.categorie)
    ? params.categorie[0]
    : params.categorie;

  const category: LeaderboardCategory = raw && isCategory(raw) ? raw : "points";

  const showTeams = raw === "equipes";
  const definition = categoryOf(category);

  const team = await ownTeam();

  const [board, teams] = await Promise.all([
    showTeams ? Promise.resolve(null) : getLeaderboard(category),
    showTeams ? getTeamLeaderboard(team?.id ?? null) : Promise.resolve(null),
  ]);

  const computedAt = board?.computedAt ?? teams?.computedAt ?? null;

  return (
    <ParticipantShell title="Classements">
      {/* Tabs in the address bar. Eight of them, and that is deliberate: at
          600 participants a single ranking interests the first ten. */}
      <nav aria-label="Catégories" className="flex flex-wrap gap-2">
        {CATEGORIES.map((entry) => (
          <Link
            key={entry.key}
            href={`/jeu/classement?categorie=${entry.key}`}
            className={cn(
              "border-line min-h-9 rounded-full border px-3 py-1.5 text-sm font-medium",
              !showTeams && entry.key === category
                ? "border-brand-blue bg-brand-blue-soft text-brand-blue"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {entry.label}
          </Link>
        ))}

        <Link
          href="/jeu/classement?categorie=equipes"
          className={cn(
            "border-line min-h-9 rounded-full border px-3 py-1.5 text-sm font-medium",
            showTeams
              ? "border-brand-blue bg-brand-blue-soft text-brand-blue"
              : "text-ink-muted hover:text-ink",
          )}
        >
          Équipes
        </Link>
      </nav>

      {showTeams && teams ? (
        <TeamBoard board={teams} />
      ) : (
        board && (
          <>
            <p className="text-ink-muted">{definition.description}</p>

            {board.rows.length === 0 ? (
              <Alert tone="info" title="Le classement est encore vide">
                Il se remplira dès les premiers défis réussis. Rien n’est cassé
                — il n’y a simplement rien à classer pour l’instant.
              </Alert>
            ) : (
              <>
                <ol className="border-line divide-line divide-y border-y">
                  {board.rows.map((row) => (
                    <li
                      key={row.profileId}
                      className={cn(
                        "flex items-center justify-between gap-3 py-3",
                        row.isSelf && "bg-brand-blue-soft -mx-2 px-2",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-ink-muted w-8 text-right text-sm tabular-nums">
                          {row.rank}
                        </span>
                        <span className="text-ink font-medium">
                          {row.displayName}
                          {row.isSelf && (
                            <span className="text-brand-blue"> — vous</span>
                          )}
                        </span>
                      </span>

                      <span className="text-ink font-semibold tabular-nums">
                        {formatValue(row.value, definition.unit)}
                      </span>
                    </li>
                  ))}
                </ol>

                {/* Only when the reader is not already visible above. The
                    whole reason this exists is the four hundred people who
                    are not in the top fifty. */}
                {board.own && !board.rows.some((row) => row.isSelf) && (
                  <div className="border-brand-blue bg-brand-blue-soft flex items-center justify-between gap-3 rounded-xl border p-3">
                    <span className="flex items-center gap-3">
                      <span className="text-brand-blue w-8 text-right text-sm font-bold tabular-nums">
                        {board.own.rank}
                      </span>
                      <span className="text-ink font-medium">
                        {board.own.displayName} — vous
                      </span>
                    </span>
                    <span className="text-ink font-semibold tabular-nums">
                      {formatValue(board.own.value, definition.unit)}
                    </span>
                  </div>
                )}

                <p className="text-ink-muted text-sm">
                  {board.total} participant{board.total > 1 ? "s" : ""} classé
                  {board.total > 1 ? "s" : ""}.
                </p>
              </>
            )}
          </>
        )
      )}

      <ComputedAt at={computedAt} />
    </ParticipantShell>
  );
}

/**
 * The team ranking, with its rule written out.
 *
 * **The rule is on the page, in plain French** (story 7.5 AC 3). A
 * normalisation people find unfair is worse than no team ranking at all, and
 * the only defence is being able to read what it does. The raw total stays
 * beside the score for the same reason: that is the figure a company is proud
 * of, and hiding it in the name of fairness would be badly received.
 */
function TeamBoard({
  board,
}: {
  board: Awaited<ReturnType<typeof getTeamLeaderboard>>;
}) {
  if (board.rows.length === 0) {
    return (
      <Alert tone="info" title="Aucune équipe classée">
        Une équipe est classée à partir de {board.minMembers} membres, et dès
        ses premiers défis réussis.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Comment ce classement est calculé">
        {explainNormalisation(board.exponent)}
      </Alert>

      <ol className="border-line divide-line divide-y border-y">
        {board.rows.map((row) => (
          <li
            key={row.teamId}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 py-3",
              row.isOwn && "bg-brand-blue-soft -mx-2 px-2",
            )}
          >
            <span className="flex items-center gap-3">
              <span className="text-ink-muted w-8 text-right text-sm tabular-nums">
                {row.rank}
              </span>
              <span>
                <Link
                  href={`/jeu/equipe/${row.slug}`}
                  className="text-ink block font-medium underline-offset-4 hover:underline"
                >
                  {row.name}
                  {row.isOwn && (
                    <span className="text-brand-blue"> — votre équipe</span>
                  )}
                </Link>
                <span className="text-ink-muted block text-sm">
                  {row.memberCount} membre{row.memberCount > 1 ? "s" : ""} ·{" "}
                  {row.points} point{row.points > 1 ? "s" : ""} au total
                </span>
              </span>
            </span>

            <Badge tone="orange">{Math.round(row.score)}</Badge>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * When the figures were last computed.
 *
 * Said out loud so nobody takes a fifteen-minute lag for an error — which is
 * exactly what somebody does after validating a challenge and not seeing
 * their points move.
 */
function ComputedAt({ at }: { at: string | null }) {
  if (!at) return null;

  return (
    <p className="text-ink-muted text-sm">
      Calculé le{" "}
      {new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date(at))}
      . Les classements sont recalculés toutes les quinze minutes : un défi
      validé à l’instant peut mettre un moment à s’y voir.
    </p>
  );
}
