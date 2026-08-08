import Link from "next/link";
import { redirect } from "next/navigation";

import { ParticipantShell } from "@/components/layout/participant-shell";
import { DeleteAccountForm } from "@/components/privacy/delete-account-form";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
import { deleteMyAccount } from "@/lib/privacy/actions";
import { getParticipantAccess } from "@/lib/registration/access";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Mes données — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The two rights that have to be reachable without writing to anybody
 * (stories 11.1 and 11.2).
 *
 * One screen rather than two, and the export placed above the erasure. Whoever
 * comes here to leave should walk past the offer to take their month of sport
 * with them first — it costs one click and it is the difference between
 * leaving and losing.
 *
 * Everything on this page is said plainly, including what does **not** get
 * deleted. A privacy screen that only lists what it erases is a screen that
 * will be contradicted by the first person who asks about their receipt.
 */
export default async function MyDataPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware redirects unauthenticated visitors. Checked again because a
  // page must never depend on middleware alone for its access control.
  if (!user) redirect(ROUTES.signIn);

  const [{ data: profile }, access] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    getParticipantAccess(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <ParticipantShell
      title="Mes données"
      intro="Les récupérer, ou tout effacer. Sans écrire à personne."
      tabs={access.isActive}
    >
      <Card>
        <CardTitle>Récupérer mes données</CardTitle>
        <CardBody>
          <p>
            Un fichier avec tout ce que nous conservons sur vous : votre profil,
            votre inscription, vos paiements, vos consentements, vos activités
            sportives, vos défis, vos cartes et votre équipe.
          </p>
          <p className="mt-3 text-sm">
            Le fichier ne contient <strong>pas</strong> les jetons d’accès à
            votre compte Strava — ils sont chiffrés et ne quittent jamais nos
            serveurs — ni vos données bancaires, que nous ne recevons jamais :
            seul Stripe les détient.
          </p>
        </CardBody>
        <p className="mt-4">
          <a
            href="/mon-compte/donnees/export"
            className={buttonClasses({ variant: "secondary" })}
            download
          >
            Télécharger mes données (JSON)
          </a>
        </p>
      </Card>

      <Card>
        <CardTitle>Déconnecter Strava</CardTitle>
        <CardBody>
          <p>
            Vous pouvez couper le lien avec Strava sans effacer votre compte.
            L’autorisation est retirée chez Strava, et ce que vous avez déjà
            gagné reste acquis.
          </p>
        </CardBody>
        <p className="mt-4">
          <Link
            href="/mon-compte/activites"
            className={buttonClasses({ variant: "ghost" })}
          >
            Gérer ma connexion sportive
          </Link>
        </p>
      </Card>

      <Card>
        <CardTitle>Effacer mon compte</CardTitle>
        <CardBody>
          <p>
            <strong>C’est irréversible.</strong> Sont supprimés : votre profil
            et votre pseudonyme, vos activités sportives, vos défis, vos cartes,
            votre appartenance à une équipe, votre adresse de livraison et vos
            abonnements aux notifications. Votre autorisation Strava est retirée
            chez Strava.
          </p>

          {/* Said here and not only in the privacy policy. Somebody about to
              press this button is the person who needs to know. */}
          <p className="mt-3 text-sm">
            <strong>Ce qui subsiste :</strong> les lignes comptables de vos
            paiements — le montant et la date. La loi impose à l’association de
            les conserver pour justifier son don. Le lien vers votre personne
            est rompu : ces lignes ne vous désignent plus.
          </p>

          {access.isActive && (
            <p className="mt-3 text-sm">
              Effacer votre compte <strong>ne vous rembourse pas</strong>. Si
              c’est un remboursement que vous voulez, écrivez-nous avant
              d’effacer : après, nous n’aurons plus de quoi vous retrouver.
            </p>
          )}
        </CardBody>

        <div className="mt-5">
          {isAdmin ? (
            <Alert tone="info" title="Compte d’organisation">
              L’effacement d’un compte d’organisation se fait à la main : le
              journal du back-office doit conserver l’auteur de chaque geste.
            </Alert>
          ) : (
            <DeleteAccountForm
              action={deleteMyAccount}
              displayName={profile?.display_name ?? ""}
            />
          )}
        </div>
      </Card>

      <p className="text-ink-muted text-sm">
        Le détail de ce que nous collectons, pourquoi et pour combien de temps
        est dans la{" "}
        <Link href="/confidentialite" className="text-brand-blue underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </ParticipantShell>
  );
}
