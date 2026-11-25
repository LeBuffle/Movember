import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import {
  formatRate,
  summarisePayments,
  type PaymentRow,
} from "@/lib/accounting/totals";
import { getBreakdown } from "@/lib/accounting/breakdown";
import { listPayments } from "@/lib/accounting/payments";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { formatEuros } from "@/lib/registration/tiers";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Collecte — back-office",
};

export const dynamic = "force-dynamic";

/**
 * What has actually been collected, and what it really cost.
 *
 * The screen exists for one figure above all: **the real fee rate**. Until
 * now the project has said "about 1,4 % + 0,25 €", which is a fair estimate
 * and wrong for a good share of payments. Decision P2 — whether the site may
 * claim "100 % reversé" — has been waiting on a measurement rather than a
 * guess, and this is where the measurement shows up.
 *
 * Every total says whether it is complete. A figure whose fees are not all
 * known is presented as provisional, never rounded off into something that
 * looks final: a total that is wrong and believed is worse than a total that
 * is missing and chased.
 *
 * Read through the administrator's session, so row level security answers.
 */
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  const { data, error } = edition
    ? await supabase
        .from("payments")
        .select(
          "kind, gross_cents, fee_cents, donation_cents, counterpart_cents",
        )
        .eq("edition_id", edition.id)
    : { data: null, error: null };

  if (error) {
    return (
      <Alert tone="danger" title="La collecte n’a pas pu être lue">
        Réessayez dans un instant. Nous préférons ne rien afficher plutôt qu’un
        total dont nous ne sommes pas sûrs.
      </Alert>
    );
  }

  const totals = summarisePayments((data ?? []) as PaymentRow[]);
  const payments = await listPayments();
  const breakdown = await getBreakdown();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">Collecte</h1>
        <p className="text-ink-muted mt-2">
          Les encaissements de l’édition {EDITION_YEAR}, avec les frais
          réellement prélevés par Stripe — jamais estimés.
        </p>
      </div>

      {query.rembourse && (
        <Alert tone="success" title="Remboursement effectué">
          L’argent est reparti chez le participant, son accès au jeu est retiré,
          et l’opération est inscrite au journal du back-office.
        </Alert>
      )}

      {totals.incomeCount === 0 ? (
        <Alert tone="info" title="Aucun encaissement pour l’instant">
          Les totaux apparaîtront dès la première inscription payée.
        </Alert>
      ) : (
        <>
          {!totals.complete && (
            <Alert
              tone="warning"
              title={`${totals.pendingFeeCount} encaissement${totals.pendingFeeCount > 1 ? "s" : ""} sans frais connus`}
            >
              Stripe communique la commission un instant après le paiement, et
              une tâche automatique la récupère chaque heure. Tant qu’elle
              manque, les totaux ci-dessous sont{" "}
              <strong>provisoires et sous-estiment les frais</strong>. Cela
              représente {formatEuros(totals.pendingFeeGrossCents)} en attente.
            </Alert>
          )}

          <section aria-labelledby="totaux" className="space-y-4">
            <h2 id="totaux" className="text-ink text-xl font-bold">
              Les montants
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardTitle>Encaissé</CardTitle>
                <CardBody>
                  <p className="text-brand-blue text-3xl font-extrabold">
                    {formatEuros(totals.grossCents)}
                  </p>
                  {/* "Encaissements" rather than "inscriptions": since
                      epic 10 the count also holds the packs, and calling the
                      lot "inscriptions" would overstate how many people are
                      playing. */}
                  <p className="mt-1 text-sm">
                    {totals.incomeCount} encaissement
                    {totals.incomeCount > 1 ? "s" : ""}
                    {breakdown.packs.count > 0 && (
                      <>
                        {" "}
                        dont {breakdown.packs.count} pack
                        {breakdown.packs.count > 1 ? "s" : ""}
                      </>
                    )}
                    .
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardTitle>Frais Stripe</CardTitle>
                <CardBody>
                  <p className="text-ink text-3xl font-extrabold">
                    {formatEuros(totals.knownFeeCents)}
                  </p>
                  <p className="mt-1 text-sm">
                    {totals.feeRate === null ? (
                      "Aucun frais connu pour l’instant."
                    ) : (
                      <>
                        Soit <strong>{formatRate(totals.feeRate)}</strong> du
                        montant encaissé,{" "}
                        {formatEuros(totals.averageFeeCents ?? 0)} par paiement
                        en moyenne.
                      </>
                    )}
                  </p>
                </CardBody>
              </Card>

              <Card accent>
                <CardTitle>Net à l’association</CardTitle>
                <CardBody>
                  <p className="text-brand-orange-ink text-3xl font-extrabold">
                    {formatEuros(totals.netCents)}
                  </p>
                  <p className="mt-1 text-sm">
                    Encaissé, moins les remboursements et les frais connus.
                  </p>
                </CardBody>
              </Card>
            </div>
          </section>

          <section aria-labelledby="engagement" className="space-y-4">
            <h2 id="engagement" className="text-ink text-xl font-bold">
              Ce qui est promis à la fondation
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardTitle>Part reversée</CardTitle>
                <CardBody>
                  <p className="text-brand-blue text-3xl font-extrabold">
                    {formatEuros(totals.donationCents)}
                  </p>
                  <p className="mt-1 text-sm">
                    L’engagement pris auprès des participants, cumulé sur toutes
                    les inscriptions.
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardTitle>Part contrepartie</CardTitle>
                <CardBody>
                  <p className="text-ink text-3xl font-extrabold">
                    {formatEuros(totals.counterpartCents)}
                  </p>
                  <p className="mt-1 text-sm">
                    Ce qui couvre les médailles, les cartes et les frais de
                    l’association.
                  </p>
                </CardBody>
              </Card>
            </div>

            <DonationCoverage
              donationCents={totals.donationCents}
              netCents={totals.netCents}
              complete={totals.complete}
            />
          </section>

          <section aria-labelledby="ventilation" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="ventilation" className="text-ink text-xl font-bold">
                Par niveau d’inscription
              </h2>

              {/* A plain anchor, not a `<Link>`: this address returns a file,
                  and Next's router would try to navigate to it. */}
              <a
                href="/admin/collecte/export"
                download
                className={buttonClasses({ size: "sm" })}
              >
                Export comptable (CSV)
              </a>
            </div>

            {breakdown.tiers.length === 0 &&
            breakdown.packs.count === 0 &&
            breakdown.credits.count === 0 ? (
              <p className="text-ink-muted">
                Aucun encaissement pour le moment. La ventilation apparaîtra dès
                la première inscription.
              </p>
            ) : (
              <>
                <ul className="border-line divide-line divide-y rounded-xl border">
                  {breakdown.tiers.map((tier) => (
                    <li key={tier.slug} className="p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-ink font-semibold">
                          {tier.name}
                        </span>
                        <span className="text-ink text-lg font-bold">
                          {formatEuros(tier.grossCents)}
                        </span>
                      </div>

                      <p className="text-ink-muted mt-1 text-sm">
                        {tier.count} inscription{tier.count > 1 ? "s" : ""} ·{" "}
                        {formatEuros(tier.donationCents)} engagés auprès de la
                        fondation
                        {tier.refundCount > 0 && (
                          <>
                            {" · "}
                            {tier.refundCount} remboursement
                            {tier.refundCount > 1 ? "s" : ""} pour{" "}
                            {formatEuros(tier.refundedCents)}
                          </>
                        )}
                      </p>
                    </li>
                  ))}

                  {/* Packs on their own line (epic 10). Their revenue is
                      handed over in full — there is nothing to post and
                      nothing to print — so "engagés" equals "encaissé", and
                      the line says so rather than leaving it to be assumed. */}
                  {breakdown.packs.count > 0 && (
                    <li className="p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-ink font-semibold">
                          Packs de cartes
                        </span>
                        <span className="text-ink text-lg font-bold">
                          {formatEuros(breakdown.packs.grossCents)}
                        </span>
                      </div>

                      <p className="text-ink-muted mt-1 text-sm">
                        {breakdown.packs.count} pack
                        {breakdown.packs.count > 1 ? "s" : ""} vendu
                        {breakdown.packs.count > 1 ? "s" : ""} ·{" "}
                        {formatEuros(breakdown.packs.donationCents)} engagés
                        auprès de la fondation, soit l’intégralité
                      </p>
                    </li>
                  )}
                  {/* Duel credits, on their own line for the same reason
                      (story 12.8). The two figures under the amount are
                      credits and not money: the gap between them is what
                      decision P8 hands to the foundation on 30 November
                      without a duel ever having been sent. */}
                  {breakdown.credits.count > 0 && (
                    <li className="p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-ink font-semibold">
                          Crédits de défis
                        </span>
                        <span className="text-ink text-lg font-bold">
                          {formatEuros(breakdown.credits.grossCents)}
                        </span>
                      </div>

                      <p className="text-ink-muted mt-1 text-sm">
                        {breakdown.credits.count} lot
                        {breakdown.credits.count > 1 ? "s" : ""} vendu
                        {breakdown.credits.count > 1 ? "s" : ""} ·{" "}
                        {formatEuros(breakdown.credits.donationCents)} engagés
                        auprès de la fondation, soit l’intégralité
                      </p>

                      <p className="text-ink-muted mt-1 text-sm">
                        {breakdown.credits.bought} crédit
                        {breakdown.credits.bought > 1 ? "s" : ""} acheté
                        {breakdown.credits.bought > 1 ? "s" : ""} ·{" "}
                        {breakdown.credits.spent} dépensé
                        {breakdown.credits.spent > 1 ? "s" : ""} ·{" "}
                        <strong>
                          {Math.max(
                            0,
                            breakdown.credits.bought - breakdown.credits.spent,
                          )}{" "}
                          non utilisé
                          {breakdown.credits.bought - breakdown.credits.spent >
                          1
                            ? "s"
                            : ""}
                        </strong>
                      </p>
                    </li>
                  )}
                </ul>

                {/* The reconciliation, said out loud. Two figures that ought
                    to be equal and are not, on an accounting screen, ruin
                    trust in the whole screen — including in the figures that
                    are right. */}
                {breakdown.reconciles ? (
                  <p className="text-ink-muted text-sm">
                    Le total des niveaux correspond au total général :{" "}
                    {formatEuros(breakdown.totals.grossCents)}.
                  </p>
                ) : (
                  <Alert tone="warning" title="La ventilation ne boucle pas">
                    {breakdown.unattributed.count} encaissement
                    {breakdown.unattributed.count > 1 ? "s" : ""} pour{" "}
                    {formatEuros(breakdown.unattributed.grossCents)} n’
                    {breakdown.unattributed.count > 1 ? "ont" : "a"} pas de
                    niveau rattaché. Le total général reste juste ; c’est la
                    répartition qui est incomplète.
                  </Alert>
                )}
              </>
            )}
          </section>

          <section aria-labelledby="remboursements" className="space-y-3">
            <h2 id="remboursements" className="text-ink text-xl font-bold">
              Remboursements
            </h2>

            {totals.refundCount === 0 ? (
              <p className="text-ink-muted">Aucun remboursement.</p>
            ) : (
              <p className="text-ink">
                {totals.refundCount} remboursement
                {totals.refundCount > 1 ? "s" : ""}, pour{" "}
                {formatEuros(totals.refundedCents)}. Déjà déduits du net
                ci-dessus.
              </p>
            )}
          </section>

          <section aria-labelledby="encaissements" className="space-y-3">
            <h2 id="encaissements" className="text-ink text-xl font-bold">
              Les encaissements
            </h2>
            <p className="text-ink-muted text-sm">
              Les cent derniers. Rembourser rend l’argent au participant et lui
              retire l’accès au jeu — l’encaissement d’origine reste inscrit tel
              quel dans la comptabilité.
            </p>

            <div className="border-line overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-sunken text-ink-muted">
                  <tr>
                    <th scope="col" className="p-3 font-semibold">
                      Participant
                    </th>
                    <th scope="col" className="p-3 font-semibold">
                      Montant
                    </th>
                    <th scope="col" className="p-3 font-semibold">
                      Frais
                    </th>
                    <th scope="col" className="p-3 font-semibold">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="text-ink p-3">{payment.displayName}</td>
                      <td className="text-ink p-3 whitespace-nowrap">
                        {formatEuros(payment.grossCents)}
                      </td>
                      <td className="text-ink-muted p-3 whitespace-nowrap">
                        {payment.feeCents === null ? (
                          <Badge tone="neutral">en attente</Badge>
                        ) : (
                          formatEuros(payment.feeCents)
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {payment.refunded ? (
                          <Badge tone="neutral">remboursé</Badge>
                        ) : payment.refundable ? (
                          <Link
                            href={`/admin/collecte/${payment.id}/rembourser`}
                            className="text-brand-blue underline underline-offset-4"
                          >
                            Rembourser
                          </Link>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Alert tone="info" title="Export comptable — lot 9">
            Cet écran donne les totaux. L’export ligne à ligne, rapprochable
            avec le relevé Stripe, arrive avec le lot 9. Les identifiants Stripe
            sont déjà enregistrés sur chaque encaissement pour cela.
          </Alert>
        </>
      )}
    </div>
  );
}

/**
 * Whether what has been promised is actually covered by what came in.
 *
 * The question behind decision P2. If the donation commitment exceeds the net
 * after fees, the association is topping up the difference out of its own
 * pocket — which may well be the intent, but has to be a choice rather than
 * something discovered in December.
 */
function DonationCoverage({
  donationCents,
  netCents,
  complete,
}: {
  donationCents: number;
  netCents: number;
  complete: boolean;
}) {
  const gap = netCents - donationCents;

  if (gap >= 0) {
    return (
      <Alert tone="success" title="L’engagement est couvert">
        Après frais, il reste {formatEuros(gap)} au-delà de ce qui est promis à
        la fondation.
        {!complete && " Chiffre provisoire : des frais restent à connaître."}
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="L’engagement dépasse ce qui reste">
      Il manque {formatEuros(-gap)} pour couvrir la part reversée après frais.
      L’association complète donc la différence — c’est un choix légitime, mais
      il doit être un choix.
      {!complete && " Chiffre provisoire : des frais restent à connaître."}
    </Alert>
  );
}
