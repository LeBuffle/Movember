import Link from "next/link";
import { notFound } from "next/navigation";

import { RefundForm } from "@/components/admin/refund-form";
import { Alert } from "@/components/ui/alert";
import { getPayment } from "@/lib/accounting/payments";
import { refundPayment } from "@/lib/accounting/refund-actions";
import { formatEuros } from "@/lib/registration/tiers";

export const metadata = {
  title: "Rembourser — back-office",
};

export const dynamic = "force-dynamic";

/**
 * The one screen in the application that sends money back out.
 *
 * It is deliberately a screen of its own rather than a button in a list. A
 * refund is not undoable, it changes someone's access to the game, and it
 * leaves a permanent entry in a journal nobody can edit. That deserves a
 * page, a figure to read, and a sentence to write.
 */
export default async function RefundPage({
  params,
}: {
  params: Promise<{ paiement: string }>;
}) {
  const { paiement } = await params;
  const payment = await getPayment(paiement);

  if (!payment) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/collecte" className="underline underline-offset-4">
            Collecte
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Rembourser une inscription
        </h1>
      </div>

      <div className="border-line bg-surface rounded-xl border p-4">
        <p className="text-ink">
          <strong>{payment.displayName}</strong> —{" "}
          {formatEuros(payment.grossCents)}
        </p>
        <p className="text-ink-muted mt-1 text-sm">
          Encaissé le{" "}
          {new Date(payment.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
      </div>

      {payment.refunded ? (
        <Alert tone="info" title="Déjà remboursé">
          Cet encaissement a déjà fait l’objet d’un remboursement. Il ne peut
          pas l’être une seconde fois.
        </Alert>
      ) : !payment.refundable ? (
        <Alert tone="warning" title="Pas de référence Stripe">
          Cet encaissement n’a pas de référence de paiement Stripe : il doit
          être traité depuis le tableau de bord Stripe, puis saisi à la main.
        </Alert>
      ) : (
        <>
          <Alert tone="warning" title="Ce que ce bouton fait, exactement">
            Stripe rend {formatEuros(payment.grossCents)} au participant, son
            inscription passe à « remboursée » et son accès au jeu est retiré.
            Une ligne de remboursement est ajoutée à la comptabilité —
            l’encaissement d’origine, lui, n’est pas modifié. L’opération n’est
            pas annulable depuis ici.
          </Alert>

          <RefundForm action={refundPayment} paymentId={payment.id} />
        </>
      )}
    </div>
  );
}
