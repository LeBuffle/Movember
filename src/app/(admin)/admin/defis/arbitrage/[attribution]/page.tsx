import Link from "next/link";
import { notFound } from "next/navigation";

import { ArbitrationForm } from "@/components/admin/arbitration-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getAssignment, listArbitrations } from "@/lib/challenges/arbitration";
import { arbitrateChallenge } from "@/lib/challenges/arbitration-actions";

export const metadata = {
  title: "Arbitrer un défi — back-office",
};

export const dynamic = "force-dynamic";

/**
 * Deciding one challenge, on a page of its own.
 *
 * Deliberately not a button in a list. An arbitration moves somebody's
 * points and therefore somebody else's rank; it deserves the facts in front
 * of it — what the challenge asked, what was measured, what has already been
 * decided about it — and a sentence to write before anything happens.
 *
 * The history at the bottom comes from the audit journal, which nobody can
 * edit or delete. It is what turns "the points changed" into "who changed
 * them, when, and why".
 */
export default async function ArbitrateAssignmentPage({
  params,
}: {
  params: Promise<{ attribution: string }>;
}) {
  const { attribution } = await params;

  const [assignment, history] = await Promise.all([
    getAssignment(attribution),
    listArbitrations(attribution),
  ]);

  if (!assignment) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link
            href={`/admin/defis/arbitrage?participant=${assignment.participantId}`}
            className="underline underline-offset-4"
          >
            Arbitrage
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          {assignment.title}
        </h1>
        <p className="text-ink-muted mt-2">
          {assignment.participantName} — défi du {assignment.assignedFor}
        </p>
      </div>

      <Card>
        <CardTitle>Ce que le défi demandait</CardTitle>
        <CardBody>
          {assignment.lines.length > 0 ? (
            <ul className="text-ink space-y-1 text-sm">
              {assignment.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted text-sm">
              Le paramétrage de ce défi n’est plus lisible. La règle n’est pas
              affichée plutôt qu’inventée.
            </p>
          )}

          <div className="border-line mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
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
            {assignment.arbitratedAt !== null && (
              <Badge tone="orange">Déjà arbitré</Badge>
            )}
            <span className="text-ink-muted text-sm">
              {assignment.pointsAwarded !== null
                ? `${assignment.pointsAwarded} points accordés`
                : `vaut ${assignment.points} points`}
            </span>
          </div>

          <p className="text-ink-muted mt-3 text-sm">
            {/* The question this whole screen exists to answer: "pourquoi ce
                défi n'est-il pas validé alors que j'ai couru ?" */}
            {assignment.measured !== null
              ? `L’évaluation a mesuré ${assignment.measured}.`
              : "Aucune activité n’a été prise en compte pour ce défi."}
          </p>
        </CardBody>
      </Card>

      <Alert tone="warning" title="Ce que fait cet écran, exactement">
        La décision est appliquée immédiatement, les points suivent, et le
        classement s’en trouve modifié. Le défi restera marqué « arbitré »
        auprès du participant comme ici. Rien n’est effacé : chaque décision
        s’ajoute au journal.
      </Alert>

      <ArbitrationForm
        action={arbitrateChallenge}
        assignmentId={assignment.id}
        status={assignment.status}
      />

      {history.length > 0 && (
        <Card>
          <CardTitle>Ce qui a déjà été décidé</CardTitle>
          <CardBody>
            <ol className="space-y-3">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="border-line border-b pb-3 last:border-0"
                >
                  <p className="text-ink text-sm font-medium">
                    {ACTIONS[entry.action] ?? entry.action} — {entry.adminName}
                  </p>
                  <p className="text-ink-muted text-sm">
                    {new Date(entry.createdAt).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {entry.previousStatus && (
                      <> — était « {STATUSES[entry.previousStatus]} »</>
                    )}
                  </p>
                  {entry.reason && (
                    <p className="text-ink mt-1 text-sm italic">
                      « {entry.reason} »
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** The journal speaks the code's vocabulary; this screen speaks French. */
const ACTIONS: Record<string, string> = {
  "challenge.validated": "Validé à la main",
  "challenge.invalidated": "Invalidé à la main",
  "challenge.arbitration_failed": "Arbitrage en échec",
};

const STATUSES: Record<string, string> = {
  open: "en cours",
  completed: "réussi",
  missed: "manqué",
};
