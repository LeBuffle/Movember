import Link from "next/link";

import { ChallengeCard } from "@/components/game/challenge-card";
import { ParticipantShell } from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getChallengeHistory } from "@/lib/challenges/assignments";

export const metadata = {
  title: "Mon historique — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Everything the participant has done since the first of the month.
 *
 * **A screen of motivation as much as of consultation.** The cumulative total
 * is what people come for; the detail is what they reach for when they think
 * a challenge was wrongly marked missed — and being able to see *which
 * activity* validated a challenge, or that none did, answers the most common
 * support question on its own.
 *
 * Read through the participant's own session, so row level security is what
 * keeps one history out of another person's reach.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.page) ? query.page[0] : query.page;

  const history = await getChallengeHistory(Number(raw) || 1);

  return (
    <ParticipantShell title="Mon historique">
      {history.total === 0 ? (
        <Alert tone="info" title="Rien à revoir pour l’instant">
          Vos défis apparaîtront ici au fur et à mesure du mois.
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card accent>
              <CardTitle>Points</CardTitle>
              <CardBody>
                <p className="text-brand-orange-ink text-3xl font-extrabold">
                  {history.stats.points}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardTitle>Défis réussis</CardTitle>
              <CardBody>
                <p className="text-brand-blue text-3xl font-extrabold">
                  {history.stats.completed}
                </p>
                <p className="mt-1 text-sm">sur {history.total} reçus</p>
              </CardBody>
            </Card>

            <Card>
              <CardTitle>Encore jouables</CardTitle>
              <CardBody>
                <p className="text-ink text-3xl font-extrabold">
                  {history.stats.open}
                </p>
                <p className="mt-1 text-sm">
                  Un défi non validé reste ouvert : une activité plus tardive
                  peut encore le compléter.
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-3">
            {history.items.map((challenge) => (
              <div key={challenge.id}>
                <p className="text-ink-muted mb-1 text-sm">
                  <time dateTime={challenge.assignedFor}>
                    {formatDay(challenge.assignedFor)}
                  </time>
                </p>
                <ChallengeCard challenge={challenge} />
              </div>
            ))}
          </div>

          {history.pageCount > 1 && (
            <nav
              aria-label="Pagination de l’historique"
              className="flex items-center justify-between gap-3"
            >
              {history.page > 1 ? (
                <Link
                  href={`/jeu/historique?page=${history.page - 1}`}
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  Plus récents
                </Link>
              ) : (
                <span />
              )}

              <span className="text-ink-muted text-sm">
                Page {history.page} sur {history.pageCount}
              </span>

              {history.page < history.pageCount ? (
                <Link
                  href={`/jeu/historique?page=${history.page + 1}`}
                  className={buttonClasses({ variant: "ghost", size: "sm" })}
                >
                  Plus anciens
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </ParticipantShell>
  );
}

/** `2026-11-15` → `dimanche 15 novembre`. */
function formatDay(isoDate: string): string {
  // Built at midday UTC so a daylight-saving shift cannot move the date —
  // the same precaution as everywhere else a calendar day is handled.
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}
