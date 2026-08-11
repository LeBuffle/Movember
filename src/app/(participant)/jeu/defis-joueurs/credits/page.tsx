import Link from "next/link";

import { CreditBuyForm } from "@/components/duels/credit-buy-form";
import {
  ParticipantShell,
  SectionHeading,
} from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { getCreditLots, unitPriceCents } from "@/lib/duels/catalogue";
import { buyCredits } from "@/lib/duels/credit-actions";
import { listMyLotPurchases } from "@/lib/duels/purchase";
import { ownWallet, REASON_LABELS } from "@/lib/duels/wallet";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { formatEuros } from "@/lib/registration/tiers";

export const metadata = {
  title: "Mes crédits — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The wallet, and the two lots on sale (story 12.2).
 *
 * **Why lots rather than a payment per duel is written on the page**, because
 * somebody who wanted to spend 2 € and is offered 10 € deserves the reason
 * rather than a suspicion. Stripe takes about 1,4 % + 0,25 € per transaction:
 * on 2 €, that is 14 % of the amount gone; on a 10 € lot, 3,9 %. Buying by lot
 * is what keeps that money in the collection.
 *
 * Two other things are said before the price, not after it: a duel wins
 * nothing, and this is not a deductible donation.
 */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = typeof query.statut === "string" ? query.statut : null;

  const [lots, wallet, purchases] = await Promise.all([
    getCreditLots(),
    ownWallet(),
    listMyLotPurchases(),
  ]);

  return (
    <ParticipantShell
      title="Mes crédits de défi"
      eyebrow={`Édition ${EDITION_YEAR}`}
      intro="Un crédit vaut un défi envoyé à un autre participant."
    >
      {/* First, above everything: the return from Stripe. Somebody who has
          just paid is looking for a confirmation, not for a price list. */}
      {status === "succes" && (
        <Alert tone="success" title="Paiement reçu">
          <p>
            Vos crédits arrivent. Ils apparaissent dès que Stripe nous confirme
            le paiement — quelques secondes en général.
          </p>
          <p className="mt-3">
            <Link
              href="/jeu/defis-joueurs"
              className={buttonClasses({ size: "sm" })}
            >
              Aller défier quelqu’un
            </Link>
          </p>
        </Alert>
      )}

      {status === "abandon" && (
        <Alert tone="info" title="Paiement abandonné">
          Rien n’a été débité. Vous pouvez reprendre quand vous voulez.
        </Alert>
      )}

      <Card>
        <CardBody>
          <CardTitle>Votre solde</CardTitle>
          <p className="text-brand-blue mt-2 text-4xl font-extrabold">
            {wallet.balance}
          </p>
          <p className="text-ink-muted mt-1 text-sm">
            crédit{wallet.balance > 1 ? "s" : ""} disponible
            {wallet.balance > 1 ? "s" : ""}
          </p>
        </CardBody>
      </Card>

      {/* The rules, before the prices. Deliberately not a footnote. */}
      <Alert tone="info" title="Un défi envoyé ne fait gagner aucun point">
        <p>
          Défier quelqu’un est un geste social : de la fierté, une riposte, une
          plaisanterie. <strong>Aucun point, aucune carte, aucun rang</strong>{" "}
          ne change, ni pour vous ni pour lui.
        </p>
        <p className="mt-2">
          Le montant est <strong>intégralement reversé</strong> à la fondation,
          y compris les crédits que vous n’aurez pas utilisés au 30 novembre. Il
          ne s’agit pas d’un don défiscalisable : aucun reçu fiscal ne sera
          émis.
        </p>
      </Alert>

      {lots.length === 0 ? (
        <Card>
          <CardBody>
            <CardTitle>Les crédits ne sont pas en vente</CardTitle>
            <p className="text-ink-muted mt-2 text-sm">
              Aucun lot n’est disponible pour le moment. Le jeu se joue
              entièrement sans : vous pouvez recevoir des défis, les relever, et
              riposter gratuitement.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {lots.map((lot) => (
            <Card key={lot.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle>{lot.name}</CardTitle>
                    <p className="text-ink-muted mt-1 text-sm">{lot.tagline}</p>
                  </div>
                  <p className="text-ink shrink-0 text-2xl font-extrabold">
                    {formatEuros(lot.priceCents)}
                  </p>
                </div>

                <ul className="text-ink-muted mt-4 space-y-1 text-sm">
                  <li>
                    {lot.credits} défis à envoyer, soit{" "}
                    {formatEuros(unitPriceCents(lot))} le défi
                  </li>
                  <li>Utilisables tout au long du mois</li>
                  <li>
                    {formatEuros(lot.donatedCents)} reversés à la fondation
                  </li>
                </ul>

                <div className="mt-5">
                  <CreditBuyForm
                    action={buyCredits}
                    slug={lot.slug}
                    label={`Acheter — ${formatEuros(lot.priceCents)}`}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Why lots, in plain French. Somebody who wanted to pay 2 € is owed the
          reason rather than left to suspect an upsell. */}
      <Card>
        <CardBody>
          <CardTitle>Pourquoi par lot, et pas 2 € à la fois</CardTitle>
          <p className="text-ink-muted mt-2 text-sm">
            Chaque paiement par carte coûte environ 0,25 € de frais fixes. Sur
            un paiement de 2 €, c’est <strong>14 % qui partent en frais</strong>{" "}
            ; sur un lot à 10 €, moins de 4 %. Acheter par lot, c’est laisser
            cet argent dans la collecte plutôt que chez notre prestataire de
            paiement.
          </p>
        </CardBody>
      </Card>

      {wallet.movements.length > 0 && (
        <>
          <SectionHeading>Mes mouvements</SectionHeading>

          <Card>
            <CardBody>
              {/* Every movement, dated and explained. This list is the answer
                  to « j'ai payé et mon crédit a disparu » — and it is why the
                  balance is a sum rather than a stored number. */}
              <ul className="divide-line divide-y">
                {wallet.movements.map((movement) => (
                  <li
                    key={movement.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-semibold">
                        {REASON_LABELS[movement.reason]}
                      </p>
                      <p className="text-ink-muted text-xs">
                        {new Date(movement.createdAt).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {movement.note ? ` · ${movement.note}` : ""}
                      </p>
                    </div>

                    <span
                      className={
                        movement.delta > 0
                          ? "text-success shrink-0 font-bold tabular-nums"
                          : "text-ink-muted shrink-0 font-bold tabular-nums"
                      }
                    >
                      {movement.delta > 0 ? "+" : "−"}
                      {Math.abs(movement.delta)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}

      {purchases.length > 0 && (
        <>
          <SectionHeading>Mes achats</SectionHeading>

          <Card>
            <CardBody>
              <ul className="divide-line divide-y">
                {purchases.map((purchase) => (
                  <li
                    key={purchase.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-semibold">
                        {purchase.lotName}
                      </p>
                      <p className="text-ink-muted text-xs">
                        {new Date(purchase.createdAt).toLocaleDateString(
                          "fr-FR",
                        )}{" "}
                        · {formatEuros(purchase.priceCents)}
                      </p>
                    </div>

                    <span className="text-ink-muted shrink-0 text-sm">
                      {purchase.status === "paid"
                        ? `${purchase.credits} crédits`
                        : "En attente de paiement"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </ParticipantShell>
  );
}
