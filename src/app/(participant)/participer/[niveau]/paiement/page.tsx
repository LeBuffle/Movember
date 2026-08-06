import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { InstallGuide } from "@/components/pwa/install-guide";
import { ResumePayment } from "@/components/registration/resume-payment";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth/routes";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { resumeCheckout } from "@/lib/registration/actions";
import { formatEuros, getTierBySlug } from "@/lib/registration/tiers";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Paiement — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where Stripe sends the participant back, and where an unfinished
 * registration waits.
 *
 * **The state shown comes from the database, never from the address bar.**
 * `?statut=succes` only means Stripe redirected here; it does not mean the
 * payment cleared, and anyone can type it. What decides is the registration's
 * status, which only the webhook changes (architecture D5, story 2.4). So a
 * participant coming back from a successful payment is told the confirmation
 * is being processed — not that they are registered — until the row says so.
 *
 * The distinction looks pedantic and is not: a page that announces success
 * before the payment is confirmed is a page that will, one day in November,
 * congratulate someone whose card was declined.
 */

type Statut = "succes" | "abandon" | "indisponible" | "echec" | null;

function readStatut(raw: string | string[] | undefined): Statut {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === "succes" ||
    value === "abandon" ||
    value === "indisponible" ||
    value === "echec"
    ? value
    : null;
}

export default async function PaymentReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ niveau: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ niveau }, query] = await Promise.all([params, searchParams]);

  const tier = await getTierBySlug(niveau);
  if (!tier) {
    notFound();
  }

  const statut = readStatut(query.statut);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Read through the participant's own session: row level security is what
  // guarantees this shows their registration and nobody else's.
  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  let status: string | null = null;

  if (user && edition) {
    const { data } = await supabase
      .from("registrations")
      .select("status")
      .eq("profile_id", user.id)
      .eq("edition_id", edition.id)
      .maybeSingle();

    status = data?.status ?? null;
  }

  const isActive = status === "active";

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          {isActive ? "Votre inscription est confirmée" : "Votre inscription"}
        </h1>

        <p className="text-ink-muted mt-3">
          Niveau <strong>{tier.name}</strong>, {formatEuros(tier.priceCents)}.
        </p>

        <div className="mt-8 space-y-6">
          {isActive ? (
            <Alert tone="success" title="Paiement confirmé">
              Tout est en ordre. Vous recevrez un e-mail récapitulatif, et vous
              retrouverez votre inscription dans votre espace.
            </Alert>
          ) : (
            <PendingState statut={statut} />
          )}
        </div>

        {/* The installation step of the journey (story 6.2 AC 3), placed
            where a registration actually ends rather than offered later from
            a menu. On iPhone there are no notifications at all without it,
            and somebody who leaves this page without installing is somebody
            who will not hear about their first challenge. */}
        {isActive && (
          <section className="border-line mt-10 border-t pt-8">
            <h2 className="text-ink text-2xl font-bold tracking-tight">
              Dernière étape : installez l’application
            </h2>
            <p className="text-ink-muted mt-2">
              C’est ce qui vous permettra de recevoir votre défi chaque matin.
            </p>

            <div className="mt-6">
              <InstallGuide compact />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/jeu" className={buttonClasses()}>
                C’est fait, aller au jeu
              </Link>
              <Link href="/jeu" className={buttonClasses({ variant: "ghost" })}>
                Plus tard
              </Link>
            </div>
          </section>
        )}

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

/** Everything that is not "paid and confirmed". */
function PendingState({ statut }: { statut: Statut }) {
  if (statut === "succes") {
    return (
      <>
        <Alert tone="info" title="Paiement reçu, confirmation en cours">
          Votre banque a accepté le paiement. La confirmation nous parvient
          séparément, en quelques secondes. Rechargez cette page dans un instant
          — et si rien ne change, écrivez-nous : le paiement est enregistré de
          notre côté, rien n’est perdu.
        </Alert>

        <p className="text-ink-muted text-sm">
          Aucune action de votre part n’est nécessaire, et surtout ne payez pas
          une seconde fois.
        </p>
      </>
    );
  }

  if (statut === "abandon") {
    return (
      <>
        <Alert tone="warning" title="Paiement interrompu">
          Rien n’a été prélevé. Votre choix de niveau et vos acceptations sont
          conservés : vous pouvez reprendre quand vous voulez.
        </Alert>

        <ResumePayment action={resumeCheckout} />
      </>
    );
  }

  if (statut === "echec") {
    return (
      <>
        <Alert tone="danger" title="La page de paiement n’a pas pu s’ouvrir">
          Le problème vient de chez nous, pas de vous, et rien n’a été prélevé.
          Réessayez dans un instant.
        </Alert>

        <ResumePayment action={resumeCheckout} label="Réessayer" />
      </>
    );
  }

  if (statut === "indisponible") {
    return (
      <Alert tone="info" title="Le paiement n’est pas encore ouvert">
        Les inscriptions ouvriront à la mi-octobre {EDITION_YEAR}. Vous n’avez
        rien payé et rien ne vous sera prélevé : vous retrouverez votre choix
        ici le moment venu.
      </Alert>
    );
  }

  return (
    <>
      <Alert tone="info" title="Votre choix est enregistré">
        Il ne reste qu’à régler l’inscription. Le paiement se fait sur les pages
        sécurisées de Stripe : votre numéro de carte ne passe jamais par notre
        application.
      </Alert>

      <ResumePayment action={resumeCheckout} label="Payer mon inscription" />
    </>
  );
}
