import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import {
  listParticipantAssignments,
  listRecentArbitrations,
  searchParticipants,
  type ArbitrationTarget,
} from "@/lib/challenges/arbitration";

export const metadata = {
  title: "Arbitrage des défis — back-office",
};

export const dynamic = "force-dynamic";

/**
 * Finding the challenge to decide.
 *
 * The situation this screen is built for: a participant writes in saying
 * their run did not count, and the person who can do something about it is
 * holding a phone. So the way in is their pseudonym, typed into a box —
 * a dropdown of four hundred names is unusable with one thumb.
 *
 * Underneath, what has already been decided by hand this month. It is the
 * first question asked whenever a leaderboard is contested, and having it in
 * plain sight is what keeps arbitration from looking like something that
 * happens quietly.
 */
export default async function ArbitrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = single(query.q) ?? "";
  const participantId = single(query.participant);

  const [matches, assignments, recent] = await Promise.all([
    search ? searchParticipants(search) : Promise.resolve([]),
    participantId
      ? listParticipantAssignments(participantId)
      : Promise.resolve([]),
    listRecentArbitrations(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/defis" className="underline underline-offset-4">
            Défis
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Arbitrage
        </h1>
        <p className="text-ink-muted mt-2">
          Valider ou invalider un défi à la main, quand l’évaluation automatique
          se trompe.
        </p>
      </div>

      {query.arbitre === "1" && (
        <Alert tone="success" title="Arbitrage enregistré">
          Le défi et ses points ont été mis à jour, et la décision est consignée
          au journal.
        </Alert>
      )}

      <Card>
        <CardTitle>Trouver un participant</CardTitle>
        <CardBody>
          {/* A plain GET form: the result is a page anyone can bookmark, send
              to someone else, or reload — and it works before any JavaScript
              has loaded. */}
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <label
                htmlFor="recherche"
                className="text-ink text-sm font-medium"
              >
                Pseudonyme
              </label>
              <input
                id="recherche"
                name="q"
                type="search"
                defaultValue={search}
                placeholder="Deux lettres suffisent"
                className="border-line bg-surface text-ink min-h-11 rounded-lg border px-3 text-base"
              />
            </div>
            <button
              type="submit"
              className={buttonClasses({ variant: "secondary" })}
            >
              Chercher
            </button>
          </form>

          {search && matches.length === 0 && (
            <p className="text-ink-muted mt-4 text-sm">
              Aucun participant ne correspond à « {search} ».
            </p>
          )}

          {matches.length > 0 && (
            <ul className="mt-4 space-y-2">
              {matches.map((participant) => (
                <li key={participant.id}>
                  <Link
                    href={`/admin/defis/arbitrage?q=${encodeURIComponent(search)}&participant=${participant.id}`}
                    className="border-line bg-surface hover:bg-brand-blue-soft flex min-h-11 items-center rounded-lg border px-3"
                  >
                    {participant.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {participantId && (
        <section className="space-y-3">
          <h2 className="text-ink text-xl font-bold">
            Les défis de {assignments[0]?.participantName ?? "ce participant"}
          </h2>

          {assignments.length === 0 ? (
            <Alert tone="info">
              Ce participant n’a encore reçu aucun défi.
            </Alert>
          ) : (
            <ul className="space-y-2">
              {assignments.map((assignment) => (
                <li key={assignment.id}>
                  <AssignmentRow assignment={assignment} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-ink text-xl font-bold">
          Déjà arbitrés cette édition
        </h2>

        {recent.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Aucun défi n’a été décidé à la main pour l’instant.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((assignment) => (
              <li key={assignment.id}>
                <AssignmentRow assignment={assignment} showName />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AssignmentRow({
  assignment,
  showName = false,
}: {
  assignment: ArbitrationTarget;
  showName?: boolean;
}) {
  return (
    <Link
      href={`/admin/defis/arbitrage/${assignment.id}`}
      className="border-line bg-surface hover:bg-brand-blue-soft block rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink font-medium">{assignment.title}</span>
        <StatusBadge assignment={assignment} />
      </div>
      <p className="text-ink-muted mt-1 text-sm">
        {showName && <>{assignment.participantName} — </>}
        {assignment.assignedFor}
        {assignment.pointsAwarded !== null && (
          <> — {assignment.pointsAwarded} points</>
        )}
      </p>
    </Link>
  );
}

function StatusBadge({ assignment }: { assignment: ArbitrationTarget }) {
  return (
    <span className="flex flex-wrap gap-1">
      {assignment.arbitratedAt !== null && (
        /* Marked wherever the challenge appears, back-office and participant
           alike. A leaderboard where points moved without explanation is a
           leaderboard that gets contested. */
        <Badge tone="orange">Arbitré</Badge>
      )}
      <Badge
        tone={
          assignment.status === "completed"
            ? "success"
            : assignment.status === "missed"
              ? "danger"
              : "neutral"
        }
      >
        {assignment.status === "completed"
          ? "Réussi"
          : assignment.status === "missed"
            ? "Manqué"
            : "En cours"}
      </Badge>
    </span>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
