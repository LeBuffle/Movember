import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import {
  formatRate,
  summarisePayments,
  type PaymentRow,
} from "@/lib/accounting/totals";
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
export default async function CollectionPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">Collecte</h1>
        <p className="text-ink-muted mt-2">
          Les encaissements de l’édition {EDITION_YEAR}, avec les frais
          réellement prélevés par Stripe — jamais estimés.
        </p>
      </div>

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
                  <p className="mt-1 text-sm">
                    {totals.incomeCount} inscription
                    {totals.incomeCount > 1 ? "s" : ""} payée
                    {totals.incomeCount > 1 ? "s" : ""}.
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

          <section aria-labelledby="remboursements" className="space-y-3">
            <h2 id="remboursements" className="text-ink text-xl font-bold">
              Remboursements
            </h2>

            {totals.refundCount === 0 ? (
              <p className="text-ink-muted">
                Aucun remboursement.{" "}
                <Badge tone="neutral">Écran de remboursement — story 2.8</Badge>
              </p>
            ) : (
              <p className="text-ink">
                {totals.refundCount} remboursement
                {totals.refundCount > 1 ? "s" : ""}, pour{" "}
                {formatEuros(totals.refundedCents)}. Déjà déduits du net
                ci-dessus.
              </p>
            )}
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
