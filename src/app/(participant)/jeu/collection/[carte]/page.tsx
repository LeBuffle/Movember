import Link from "next/link";
import { notFound } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { CardDetail } from "@/components/cards/card-detail";
import { buttonClasses } from "@/components/ui/button";
import { getOwnedCard } from "@/lib/cards/reveal";

export const metadata = {
  title: "Ma carte — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A card's own page, found again from the album.
 *
 * **Only a card the participant holds** (`getOwnedCard`). The album shows an
 * unheld card as an outline with no title and no picture, and a page
 * reachable by typing an identifier would undo that in one step. The public
 * gallery of story 5.8 is where the whole catalogue gets shown — on purpose,
 * and to everybody.
 *
 * Rendered entirely by the server: no animation, nothing to wait for, nothing
 * that depends on a script. This is the page somebody opens to show a friend.
 */
export default async function CardPage({
  params,
}: {
  params: Promise<{ carte: string }>;
}) {
  const { carte } = await params;
  const card = await getOwnedCard(carte);

  if (!card) notFound();

  return (
    <ParticipantShell title={card.title} eyebrow="Ma collection">
      <p className="text-ink-muted text-sm">
        <Link href="/jeu/collection" className="underline underline-offset-4">
          Ma collection
        </Link>
      </p>

      <CardDetail card={card} copies={card.copies} />

      <p className="text-center">
        <Link
          href="/jeu/collection"
          className={buttonClasses({ variant: "ghost" })}
        >
          Retour à la collection
        </Link>
      </p>
    </ParticipantShell>
  );
}
