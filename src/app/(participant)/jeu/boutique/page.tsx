import Link from "next/link";

import { PackBuyForm } from "@/components/cards/pack-buy-form";
import {
  ParticipantShell,
  SectionHeading,
} from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { pendingRevealCount } from "@/lib/cards/reveal";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { buyPack } from "@/lib/packs/actions";
import { getPacks, guaranteeLabel } from "@/lib/packs/catalogue";
import { listMyPurchases } from "@/lib/packs/purchase";
import { formatEuros } from "@/lib/registration/tiers";

export const metadata = {
  title: "Boutique — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The shop (story 10.2).
 *
 * **The rule is displayed before the price, not after it.** A pack never
 * moves a rank (PRD D2, FR72), and a shop that buries that line under a
 * button is a shop that sells a misunderstanding. It is also the only reason
 * the whole thing can be offered at all without turning the game into
 * pay-to-win.
 *
 * Second thing said out loud: the amount is handed over in full. There is no
 * medal to post and nothing to print, so the association keeps nothing — and
 * that is a constraint in the database, not a promise on a page.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = typeof query.statut === "string" ? query.statut : null;

  const [packs, purchases, pending] = await Promise.all([
    getPacks(),
    listMyPurchases(),
    pendingRevealCount(),
  ]);

  return (
    <ParticipantShell
      title="Boutique"
      eyebrow={`Édition ${EDITION_YEAR}`}
      intro="Des cartes en plus pour compléter l’album. Rien de plus."
    >
      {/* First, above everything: the return from Stripe. Somebody who has
          just paid is looking for a confirmation, not for a price list. */}
      {status === "succes" && (
        <Alert tone="success" title="Paiement reçu">
          <p>
            Vos cartes arrivent. Elles apparaissent dès que Stripe nous confirme
            le paiement — quelques secondes en général.
          </p>
          <p className="mt-3">
            <Link
              href="/jeu/collection/reveler"
              className={buttonClasses({ size: "sm" })}
            >
              Découvrir mes cartes
            </Link>
          </p>
        </Alert>
      )}

      {status === "abandon" && (
        <Alert tone="info" title="Paiement abandonné">
          Rien n’a été débité. Vous pouvez reprendre quand vous voulez.
        </Alert>
      )}

      {pending > 0 && status !== "succes" && (
        <Alert
          tone="success"
          title={`${pending} carte${pending > 1 ? "s" : ""} à découvrir`}
        >
          <p className="mt-1">
            <Link
              href="/jeu/collection/reveler"
              className={buttonClasses({ size: "sm" })}
            >
              Découvrir
            </Link>
          </p>
        </Alert>
      )}

      {/* The rule, before the prices. Deliberately not a footnote. */}
      <Alert tone="info" title="Un pack n’aide pas à gagner">
        <p>
          Les cartes achetées enrichissent votre album mais{" "}
          <strong>ne comptent jamais dans le classement collection</strong>.
          Seules les cartes gagnées en relevant vos défis y comptent.
        </p>
        <p className="mt-2">
          Le montant est <strong>intégralement reversé</strong> : un pack
          n’expédie rien et n’imprime rien.
        </p>
      </Alert>

      {packs.length === 0 ? (
        <Card>
          <CardBody>
            <CardTitle>La boutique n’est pas ouverte</CardTitle>
            <p className="text-ink-muted mt-2 text-sm">
              Aucun pack n’est en vente pour le moment. Le jeu se joue
              entièrement sans — les trente défis du mois sont réalisables avec
              votre inscription seule.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {packs.map((pack) => {
            const guarantee = guaranteeLabel(pack.guaranteedRarity);

            return (
              <Card key={pack.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle>{pack.name}</CardTitle>
                      <p className="text-ink-muted mt-1 text-sm">
                        {pack.tagline}
                      </p>
                    </div>
                    <p className="text-ink shrink-0 text-2xl font-extrabold">
                      {formatEuros(pack.priceCents)}
                    </p>
                  </div>

                  <ul className="text-ink-muted mt-4 space-y-1 text-sm">
                    <li>{pack.cardCount} cartes tirées au sort</li>
                    {guarantee && (
                      <li>
                        <Badge tone="orange">{guarantee}</Badge>
                      </li>
                    )}
                    <li>
                      {formatEuros(pack.donatedCents)} reversés à la fondation
                    </li>
                  </ul>

                  <div className="mt-5">
                    <PackBuyForm
                      action={buyPack}
                      slug={pack.slug}
                      label={`Acheter — ${formatEuros(pack.priceCents)}`}
                    />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {purchases.length > 0 && (
        <>
          <SectionHeading>Mes achats</SectionHeading>

          <Card>
            <CardBody>
              <div className="divide-line divide-y">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-semibold">
                        {purchase.packName}
                      </p>
                      <p className="text-ink-muted text-xs">
                        {new Date(purchase.createdAt).toLocaleDateString(
                          "fr-FR",
                        )}{" "}
                        · {formatEuros(purchase.priceCents)}
                      </p>
                    </div>

                    {purchase.status === "paid" ? (
                      purchase.unopened > 0 ? (
                        <Link
                          href="/jeu/collection/reveler"
                          className={buttonClasses({ size: "sm" })}
                        >
                          Ouvrir ({purchase.unopened})
                        </Link>
                      ) : (
                        <Badge tone="success">Ouvert</Badge>
                      )
                    ) : (
                      /* A pending purchase is almost always an abandoned
                       checkout. Saying "non payé" rather than "en attente"
                       because waiting will not change it. */
                      <Badge tone="neutral">Non payé</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </ParticipantShell>
  );
}
