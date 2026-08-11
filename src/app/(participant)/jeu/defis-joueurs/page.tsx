import Link from "next/link";

import { DuelCard } from "@/components/duels/duel-card";
import {
  ParticipantShell,
  SectionHeading,
} from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getDuelBoard } from "@/lib/duels/read";
import { EDITION_YEAR } from "@/lib/edition/calendar";

export const metadata = {
  title: "Défis entre joueurs — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where duels live (epic 12).
 *
 * **What is received comes first, and far above what was sent.** A duel
 * received is running against a clock; a duel sent is somebody else's
 * problem. Ordering the screen the other way round would bury the only part
 * that needs acting on.
 *
 * Nothing on this page changes a ranking, and it says so — decision P7 is what
 * makes the whole mechanism defensible, and burying it would let a player
 * assume the opposite.
 */
export default async function DuelsPage() {
  const board = await getDuelBoard();

  const openReceived = board.received.filter((duel) => duel.status === "open");
  const settledReceived = board.received.filter(
    (duel) => duel.status !== "open",
  );

  return (
    <ParticipantShell
      title="Défis entre joueurs"
      eyebrow={`Édition ${EDITION_YEAR}`}
      intro="Provoquez quelqu’un, ou relevez ce qu’on vous envoie."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/jeu/defis-joueurs/credits"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {board.balance} crédit{board.balance > 1 ? "s" : ""}
        </Link>

        <Link href="/jeu/classement" className={buttonClasses({ size: "sm" })}>
          Choisir quelqu’un dans le classement
        </Link>
      </div>

      <Alert tone="info" title="Un défi ne fait gagner aucun point">
        Ni pour celui qui l’envoie, ni pour celui qui le relève. C’est un geste
        social, pas une façon de monter au classement — et un défi non relevé
        n’a <strong>aucune conséquence</strong>.
      </Alert>

      {board.optedOut && (
        <Alert tone="warning" title="Vous ne recevez pas de défis">
          <p>
            Vous avez coupé la réception dans « Mon compte ». Vous pouvez
            toujours en envoyer.
          </p>
          <p className="mt-3">
            <Link
              href="/mon-compte"
              className={buttonClasses({ size: "sm", variant: "secondary" })}
            >
              Modifier ce réglage
            </Link>
          </p>
        </Alert>
      )}

      <SectionHeading>Défis reçus</SectionHeading>

      {openReceived.length === 0 ? (
        <Card>
          <CardBody>
            <CardTitle>Personne ne vous a défié</CardTitle>
            <p className="text-ink-muted mt-2 text-sm">
              Rien à faire pour l’instant. Cela peut changer à tout moment — et
              vous aurez alors 24 heures.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {openReceived.map((duel) => (
            <li key={duel.id}>
              <DuelCard duel={duel} side="received" />
            </li>
          ))}
        </ul>
      )}

      {settledReceived.length > 0 && (
        <>
          <SectionHeading>Déjà passés</SectionHeading>
          <ul className="space-y-3">
            {settledReceived.map((duel) => (
              <li key={duel.id}>
                <DuelCard duel={duel} side="received" />
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionHeading>Défis envoyés</SectionHeading>

      {board.sent.length === 0 ? (
        <Card>
          <CardBody>
            <CardTitle>Vous n’avez défié personne</CardTitle>
            <p className="text-ink-muted mt-2 text-sm">
              Ouvrez un classement, choisissez quelqu’un, et envoyez-lui de quoi
              sortir de chez lui.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {board.sent.map((duel) => (
            <li key={duel.id}>
              <DuelCard duel={duel} side="sent" />
            </li>
          ))}
        </ul>
      )}
    </ParticipantShell>
  );
}
