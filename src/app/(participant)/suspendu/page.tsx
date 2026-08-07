import { redirect } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { Alert } from "@/components/ui/alert";
import { ROUTES } from "@/lib/auth/routes";
import { getParticipantAccess } from "@/lib/registration/access";

export const metadata = {
  title: "Votre accès au jeu — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * What a suspended participant sees (story 8.7 AC 6).
 *
 * **Not an error page.** They did not break anything and nothing is down; a
 * decision was taken about them. "Page introuvable" would leave them
 * refreshing, and "erreur" would send them to the support address of a
 * problem that does not exist.
 *
 * The reason is shown. Withholding it would be the worse choice by some
 * distance: somebody who does not know why cannot answer, and the first
 * thing they will do is create a second account.
 *
 * No tab bar — every tab would bounce them straight back here.
 */
export default async function SuspendedPage() {
  const access = await getParticipantAccess();

  if (!access.signedIn) redirect(ROUTES.signIn);

  // Someone who is not suspended has no business here, and landing on this
  // page by mistake would be alarming out of all proportion.
  if (!access.suspension) redirect("/jeu");

  return (
    <ParticipantShell title="Votre accès au jeu" tabs={false}>
      <Alert tone="warning" title="Votre accès a été suspendu">
        <p>
          L’organisation a suspendu votre participation le{" "}
          {formatDay(access.suspension.since)}.
        </p>

        {access.suspension.reason && (
          <p className="mt-3">
            <span className="font-semibold">Motif indiqué :</span>{" "}
            {access.suspension.reason}
          </p>
        )}

        <p className="mt-3">
          Votre inscription et votre paiement ne sont pas annulés. Si cette
          décision vous semble injustifiée, écrivez à l’organisation : elle peut
          la lever.
        </p>
      </Alert>

      <p className="text-ink-muted text-sm">
        Créer un second compte ne rétablirait pas votre accès et compliquerait
        la discussion. Une réponse à cette adresse suffit.
      </p>
    </ParticipantShell>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
