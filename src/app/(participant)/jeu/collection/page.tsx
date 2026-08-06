import Link from "next/link";

import { CardFace } from "@/components/cards/card-face";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getAlbum } from "@/lib/cards/collection";
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
  const album = await getAlbum();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/jeu" className="underline underline-offset-4">
            Le jeu
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Ma collection
        </h1>
        <p className="text-ink-muted mt-2">
          Une carte par défi réussi, tirée au sort. Édition {EDITION_YEAR}.
        </p>
      </div>

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
                    <CardFace card={card} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
