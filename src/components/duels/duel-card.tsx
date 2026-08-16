import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { expiryMessage } from "@/lib/duels/messages";
import type { DuelView } from "@/lib/duels/read";

/**
 * One duel, on a card (stories 12.3 and 12.6).
 *
 * Two points of view on the same row, and they say different things: what the
 * receiver needs is the deadline, what the sender needs is the outcome. The
 * component takes which side it is showing rather than guessing from the data,
 * because guessing is how a sender ends up reading "il vous reste 3 h".
 */
export function DuelCard({
  duel,
  side,
}: {
  duel: DuelView;
  side: "received" | "sent";
}) {
  const open = duel.status === "open";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        open
          ? "border-brand-blue bg-brand-blue-soft"
          : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink font-semibold">
          {duel.typeName}
          {duel.free && (
            <span className="text-brand-blue font-normal"> — riposte</span>
          )}
        </p>
        <p className="text-ink-muted text-sm">
          {side === "received" ? "de " : "à "}
          <strong className="text-ink">{duel.otherName}</strong>
        </p>
      </div>

      {duel.typeTagline && (
        <p className="text-ink-muted mt-1 text-sm">{duel.typeTagline}</p>
      )}

      <p className="text-ink-muted mt-2 text-sm">
        <Outcome duel={duel} side={side} />
      </p>

      {/* The free riposte, offered only where it exists: on a duel the reader
          received and met, and only once (story 12.6 AC 3). */}
      {side === "received" && duel.ripostable && (
        <p className="mt-3">
          <Link
            href={`/jeu/defis-joueurs/envoyer?joueur=${duel.otherId}&riposte=${duel.id}`}
            className={buttonClasses({ size: "sm" })}
          >
            Riposter gratuitement
          </Link>
        </p>
      )}
    </div>
  );
}

function Outcome({
  duel,
  side,
}: {
  duel: DuelView;
  side: "received" | "sent";
}) {
  if (duel.status === "met") {
    return side === "received" ? (
      <>Relevé. Rien de plus à faire — et rien à perdre non plus.</>
    ) : (
      <>Relevé par {duel.otherName}. Bien joué à lui.</>
    );
  }

  if (duel.status === "expired") {
    /* The sentence drawn when it expired, the same one every time: a message
       that changes at each refresh reads as a defect rather than as a joke.
       And the receiver reads nothing about it — they did nothing wrong, they
       did not ask for this duel (story 12.6 AC 7). */
    return side === "sent" ? (
      <>{expiryMessage(duel.expiryMessageKey)}</>
    ) : (
      <>Le délai est passé. Aucune conséquence, aucun point perdu.</>
    );
  }

  return <Remaining expiresAt={duel.expiresAt} side={side} />;
}

/**
 * How long is left, rounded to the hour.
 *
 * To the hour and not to the minute: a countdown to the minute on a
 * server-rendered page is wrong the second it is displayed, and a wrong
 * countdown is worse than a vague one.
 */
function Remaining({
  expiresAt,
  side,
}: {
  expiresAt: string;
  side: "received" | "sent";
}) {
  /* `react-hooks/purity` (nouveau avec Next 16) signale l'appel à l'horloge
     pendant le rendu. Il a raison dans un composant client, où le serveur et
     le navigateur calculeraient deux heures différentes de part et d'autre
     d'une heure pleine. Celui-ci n'existe que sur le serveur — aucun
     `"use client"` dans sa chaîne, la page est rendue à la demande — et la
     règle ne sait pas faire la différence. */
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const hours = Math.max(
    0,
    Math.round((Date.parse(expiresAt) - now) / 3_600_000),
  );

  if (side === "sent") {
    return <>En attente — encore {hours} h pour le relever.</>;
  }

  if (hours <= 1) {
    return <>Il vous reste moins d’une heure.</>;
  }

  return <>Il vous reste environ {hours} heures.</>;
}
