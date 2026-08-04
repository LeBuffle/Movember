import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/alert";
import { ROUTES } from "@/lib/auth/routes";
import { formatEuros, getTierBySlug } from "@/lib/registration/tiers";

export const metadata = {
  title: "Paiement — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Placeholder, replaced by the Stripe redirect in story 2.3.
 *
 * It exists rather than being skipped because the choice and the acceptance
 * are already recorded by the time someone arrives here: leaving them on a
 * dead link, or on a payment form that does not exist, would look like a
 * failure. This says plainly where things stand.
 *
 * Story 2.3 removes this page: the action will redirect straight to Stripe.
 */
export default async function PaymentPendingPage({
  params,
}: {
  params: Promise<{ niveau: string }>;
}) {
  const { niveau } = await params;
  const tier = await getTierBySlug(niveau);

  if (!tier) {
    notFound();
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Votre choix est enregistré
        </h1>

        <p className="text-ink-muted mt-3">
          Niveau <strong>{tier.name}</strong>, {formatEuros(tier.priceCents)}.
          Vos acceptations ont été conservées.
        </p>

        <div className="mt-8">
          <Alert tone="info" title="Le paiement n’est pas encore ouvert">
            Les inscriptions ouvriront à la mi-octobre 2026. Vous n’avez rien
            payé et rien ne vous sera prélevé : vous retrouverez votre choix ici
            le moment venu.
          </Alert>
        </div>

        <p className="mt-8">
          <Link
            href={ROUTES.account}
            className="text-brand-blue underline underline-offset-4"
          >
            Retour à mon compte
          </Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
