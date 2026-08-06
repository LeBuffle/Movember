import Link from "next/link";

import { CardDetail } from "@/components/cards/card-detail";
import { CardReveal } from "@/components/cards/card-reveal";
import { RevealContinue } from "@/components/cards/reveal-continue";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { markRevealed } from "@/lib/cards/reveal-actions";
import { nextReveal } from "@/lib/cards/reveal";

export const metadata = {
  title: "Une carte pour vous — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The moment of opening.
 *
 * Challenges validate themselves from the activities that arrive — nobody
 * presses anything, which is the right design for the game and costs it the
 * one thing a collection lives on. This screen is where that is paid back.
 *
 * One card at a time, oldest first. A pack of five arriving at once becomes
 * five moments rather than a list of five rows, and the participant decides
 * the pace.
 */
export default async function RevealPage() {
  const { card, remaining } = await nextReveal();

  if (!card) {
    return (
      <div className="space-y-6">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Rien à découvrir
        </h1>

        <Alert tone="info" title="Vous êtes à jour">
          Toutes vos cartes sont dans votre collection. La prochaine arrivera
          avec votre prochain défi réussi.
        </Alert>

        <p>
          <Link
            href="/jeu/collection"
            className={buttonClasses({ variant: "secondary" })}
          >
            Voir ma collection
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Une carte pour vous
        </h1>
        <p className="text-ink-muted mt-2">
          {card.earned
            ? "Votre défi réussi vous en fait gagner une."
            : "Elle vient de votre pack bonus."}
        </p>
      </div>

      <CardReveal>
        <CardDetail card={card} />
      </CardReveal>

      <RevealContinue
        action={markRevealed}
        grantId={card.grantId}
        remaining={remaining}
      />
    </div>
  );
}
