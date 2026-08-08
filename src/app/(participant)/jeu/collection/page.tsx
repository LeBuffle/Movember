import Link from "next/link";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { CardFace } from "@/components/cards/card-face";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getAlbum } from "@/lib/cards/collection";
import { pendingRevealCount } from "@/lib/cards/reveal";
import { EDITION_YEAR } from "@/lib/edition/calendar";

export const metadata = {
  title: "Ma collection — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The album.
 *
 * **What turns a sport-tracking application into a game.** The immediate
 * reward and the collection are the retention engine over thirty days, and
 * this is where the collection lives.
 *
 * Missing cards are shown in outline rather than hidden. An empty space you
 * can see is what makes somebody want to fill it; a list of what you already
 * have makes nobody want anything.
 */
export default async function CollectionPage() {
  const [album, pending] = await Promise.all([
    getAlbum(),
    pendingRevealCount(),
  ]);

  return (
    <ParticipantShell
      title="Ma collection"
      eyebrow={`Édition ${EDITION_YEAR}`}
      intro="Une carte par défi réussi, tirée au sort."
    >
      {/* Placed above everything else: a card waiting to be discovered is the
          only thing on this screen that asks for an action. */}
      {pending > 0 && (
        <Alert
          tone="success"
          title={`${pending} carte${pending > 1 ? "s" : ""} à découvrir`}
        >
          <p>
            Elle{pending > 1 ? "s" : ""} vous attend
            {pending > 1 ? "ent" : ""} — vous ne l{pending > 1 ? "es" : "a"}{" "}
            verrez dans l’album qu’une fois ouverte
            {pending > 1 ? "s" : ""}.
          </p>
          <p className="mt-3">
            <Link
              href="/jeu/collection/reveler"
              className={buttonClasses({ size: "sm" })}
            >
              Découvrir
            </Link>
          </p>
        </Alert>
      )}

      {album.counters.total === 0 ? (
        <Alert tone="info" title="Les cartes arrivent">
          Le jeu de cartes n’est pas encore publié. Vos défis réussis comptent
          déjà : les cartes viendront s’ajouter à votre collection.
        </Alert>
      ) : (
        <>
          {/* The two counters, side by side and named for what they are.
              Somebody who buys two packs has a fuller collection, not a
              better score — and the labels have to say it rather than imply
              it (architecture D8, NFR20). */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card accent>
              <CardTitle>Cartes gagnées</CardTitle>
              <CardBody>
                <p className="text-brand-orange-ink text-3xl font-extrabold">
                  {album.counters.earned}
                </p>
                <p className="mt-1 text-sm">
                  Obtenues en jouant. <strong>C’est ce chiffre</strong> qui
                  compte au classement collection.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardTitle>Collection complète</CardTitle>
              <CardBody>
                <p className="text-brand-blue text-3xl font-extrabold">
                  {album.counters.collected} / {album.counters.total}
                </p>
                <p className="mt-1 text-sm">
                  Toutes cartes confondues, packs inclus. Ne compte pas au
                  classement.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* The shop, reached from here and from nowhere else (story 10.2).
              It belongs next to the album — the only place where a hole in a
              collection is visible — and not in the tab bar, where a sixth
              tab would put buying on the same footing as playing. */}
          <p>
            <Link
              href="/jeu/boutique"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Compléter avec un pack
            </Link>
          </p>

          {album.groups.map((group) => (
            <section key={group.rarity} className="space-y-3">
              <h2 className="text-ink text-xl font-bold">
                {group.label}{" "}
                <span className="text-ink-muted text-base font-normal">
                  — {group.cards.filter((card) => card.copies > 0).length} sur{" "}
                  {group.cards.length}
                </span>
              </h2>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {group.cards.map((card) => (
                  <li key={card.id}>
                    {/* Only a card they hold is a link. There is nothing
                        behind an outline, and a link that leads to a refusal
                        is worse than no link. */}
                    {card.copies > 0 ? (
                      <Link
                        href={`/jeu/collection/${card.id}`}
                        className="block rounded-xl"
                      >
                        <CardFace card={card} />
                      </Link>
                    ) : (
                      <CardFace card={card} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </ParticipantShell>
  );
}
