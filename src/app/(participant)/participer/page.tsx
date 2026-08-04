import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TierCards } from "@/components/marketing/tier-cards";
import { ResumePayment } from "@/components/registration/resume-payment";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { resumeCheckout } from "@/lib/registration/actions";
import { getParticipantAccess } from "@/lib/registration/access";
import { getRegistrationTiers } from "@/lib/registration/tiers";

export const metadata = {
  title: "Participer — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where a registration in progress is picked back up.
 *
 * This page exists because several paths need somewhere honest to land:
 * someone whose payment was interrupted, someone who reaches the game before
 * paying, someone who simply comes back a week later. Each of them arrives
 * knowing *something* is unfinished and needs to be told what.
 *
 * So the state comes from the registration, and the page says one of four
 * things: it is done, it is being confirmed, it was started and can be
 * resumed, or nothing has been chosen yet.
 */
export default async function ParticipatePage() {
  const [access, tiers] = await Promise.all([
    getParticipantAccess(),
    getRegistrationTiers(),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Participer au défi
        </h1>

        <div className="mt-8">
          {access.isActive ? (
            <div className="space-y-4">
              <Alert tone="success" title="Votre inscription est active">
                Votre paiement est confirmé. Il n’y a rien d’autre à faire.
              </Alert>

              <Link href="/jeu" className={buttonClasses({ size: "lg" })}>
                Accéder au jeu
              </Link>
            </div>
          ) : access.status === "refunded" || access.status === "cancelled" ? (
            <Alert tone="warning" title="Votre inscription a été annulée">
              Le montant vous a été rendu. Si c’est une erreur, écrivez-nous —
              et vous pouvez vous réinscrire à tout moment tant que les
              inscriptions sont ouvertes.
            </Alert>
          ) : access.status === "pending" ? (
            <div className="space-y-4">
              <Alert tone="info" title="Votre inscription attend son paiement">
                Votre choix de niveau et vos acceptations sont conservés. Rien
                n’a été prélevé pour l’instant.
              </Alert>

              <ResumePayment
                action={resumeCheckout}
                label="Régler mon inscription"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-ink-muted">
                Choisissez votre niveau d’inscription. Le paiement se fait sur
                les pages sécurisées de Stripe.
              </p>

              {tiers.length > 0 ? (
                <TierCards tiers={tiers} />
              ) : (
                <Alert tone="danger" title="Les niveaux ne sont pas lisibles">
                  Réessayez dans un instant. Nous préférons ne rien afficher
                  plutôt que d’afficher un prix dont nous ne sommes pas sûrs.
                </Alert>
              )}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
