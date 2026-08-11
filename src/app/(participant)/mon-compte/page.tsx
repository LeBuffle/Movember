import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountForm } from "@/components/auth/account-form";
import { DuelOptOutForm } from "@/components/duels/opt-out-form";
import { ParticipantShell } from "@/components/layout/participant-shell";
import { InstallState } from "@/components/pwa/install-state";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { AddressReminder } from "@/components/shipping/address-reminder";
import { ROUTES } from "@/lib/auth/routes";
import { setDuelOptOut } from "@/lib/duels/actions";
import { ownBalance } from "@/lib/duels/wallet";
import { getParticipantAccess } from "@/lib/registration/access";
import { getShippingContext } from "@/lib/shipping/address";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mon compte — DEFI Movember" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already redirects unauthenticated visitors. This second
  // check is not redundant: a page must never depend on middleware alone for
  // its access control, or a matcher change silently exposes it.
  if (!user) {
    redirect(ROUTES.signIn);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, role, duels_opt_out")
    .eq("id", user.id)
    .single();

  // Only asks of those who actually have something coming (story 2.7).
  const [shipping, access, credits] = await Promise.all([
    getShippingContext(),
    getParticipantAccess(),
    ownBalance(),
  ]);

  return (
    <ParticipantShell title="Mon compte" tabs={access.isActive}>
      <div className="space-y-4">
        {/* The way forward, for somebody signed in whose registration is not
            finished. Its absence is what left the first real user stuck:
            account created, signed in, and no door anywhere on the page. */}
        {!access.isActive && (
          <Card accent>
            <CardTitle>Votre inscription n’est pas finalisée</CardTitle>
            <CardBody>
              Le jeu s’ouvre une fois l’inscription réglée. Choisissez votre
              formule — il y en a trois.
            </CardBody>
            <p className="mt-4">
              <Link href="/participer" className={buttonClasses()}>
                Choisir ma formule
              </Link>
            </p>
          </Card>
        )}

        {access.isActive && (
          <Card>
            <CardTitle>Le jeu</CardTitle>
            <CardBody>
              Votre défi du jour, votre collection et les classements.
            </CardBody>
            <p className="mt-4">
              <Link href="/jeu" className={buttonClasses()}>
                Ouvrir le jeu
              </Link>
            </p>
          </Card>
        )}

        <AddressReminder context={shipping} />

        <Card>
          <CardTitle>Pseudonyme</CardTitle>
          <CardBody>
            Il apparaît dans les classements, à la place de votre nom.
          </CardBody>

          <p className="text-ink mt-3 text-xl font-bold">
            {profile?.display_name ?? "—"}
          </p>

          {/* Said plainly rather than shown as a disabled field: a greyed-out
              input reads as something temporarily unavailable, and invites
              somebody to come back and look for the button. */}
          <p className="text-ink-muted mt-1 text-sm">
            Il a été choisi à l’inscription et ne change plus : vos coéquipiers
            et les classements vous connaissent sous ce nom. Une erreur ?
            Écrivez à l’organisation, qui peut la corriger.
          </p>

          <div className="border-line mt-4 border-t pt-4">
            <AccountForm />
          </div>
        </Card>

        <Card>
          <CardTitle>Adresse e-mail</CardTitle>
          <CardBody>
            <p>{profile?.email ?? user.email}</p>
            <p className="mt-2 text-sm">
              Visible de vous seul et de l’organisation. Jamais des autres
              participants.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Mes activités sportives</CardTitle>
          <CardBody>
            <p>
              Ce que le jeu récupère de vos sorties, ce qu’il ne récupère
              jamais, et votre autorisation.
            </p>
            <p className="mt-3">
              <Link
                href="/mon-compte/activites"
                className="text-brand-blue underline underline-offset-4"
              >
                Voir et gérer mon autorisation
              </Link>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Mes notifications</CardTitle>
          <CardBody>
            <p>
              Le rappel de votre défi du jour, et le message quand une sortie le
              valide.
            </p>
            <p className="mt-3">
              <Link
                href="/mon-compte/notifications"
                className="text-brand-blue underline underline-offset-4"
              >
                Activer ou gérer mes notifications
              </Link>
            </p>
          </CardBody>
        </Card>

        {/* The switch, on the account page rather than under the
            notifications: cutting duels is not cutting a message, it is
            leaving a part of the game. Somebody looking for it will look
            here. */}
        <Card>
          <CardTitle>Défis d’autres participants</CardTitle>
          <CardBody>
            <p>
              Un autre participant peut vous envoyer un défi sportif à relever
              dans les 24 h. Cinq au maximum par jour, sans aucune pénalité si
              vous n’en relevez aucun.
            </p>
            {/* The balance, here as well as on the wallet screen. Somebody
                who wants to know how many duels they have left looks at their
                account, not at the page for challenging one person — and a
                figure only visible at the moment of spending is a figure
                found too late. */}
            {credits !== null && (
              <div className="border-line mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                <span className="text-ink">
                  <strong className="text-brand-blue text-2xl font-extrabold">
                    {credits}
                  </strong>{" "}
                  crédit{credits > 1 ? "s" : ""} de défi
                  {credits > 1 ? "s" : ""}
                  <span className="text-ink-muted block text-sm">
                    {credits === 0
                      ? "Recevoir et relever des défis reste gratuit."
                      : "Un crédit vaut un défi envoyé."}
                  </span>
                </span>

                <Link
                  href="/jeu/defis-joueurs/credits"
                  className={buttonClasses({
                    size: "sm",
                    variant: "secondary",
                  })}
                >
                  {credits === 0 ? "En acheter" : "Voir mes crédits"}
                </Link>
              </div>
            )}

            <div className="mt-3">
              <DuelOptOutForm
                action={setDuelOptOut}
                optedOut={profile?.duels_opt_out === true}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Application installée</CardTitle>
          <CardBody>
            <p>
              Sur iPhone, les notifications quotidiennes ne fonctionnent que si
              l’application a été ajoutée à l’écran d’accueil.
            </p>
            <div className="mt-3">
              <InstallState />
            </div>
            <p className="mt-3">
              <Link
                href="/installer"
                className="text-brand-blue underline underline-offset-4"
              >
                Comment installer l’application
              </Link>
            </p>
          </CardBody>
        </Card>

        {/* Placed last, and deliberately not hidden behind a footer link. The
            two rights the GDPR gives a participant have to be reachable
            without writing to anybody (stories 11.1 et 11.2) — a privacy
            promise nobody can act on is a promise nobody believes. */}
        <Card>
          <CardTitle>Mes données</CardTitle>
          <CardBody>
            <p>
              Récupérer tout ce que nous conservons sur vous, ou effacer votre
              compte.
            </p>
            <p className="mt-3">
              <Link
                href="/mon-compte/donnees"
                className="text-brand-blue underline underline-offset-4"
              >
                Télécharger mes données ou effacer mon compte
              </Link>
            </p>
          </CardBody>
        </Card>

        {profile?.role === "admin" && (
          <Card accent>
            <CardTitle>Compte administrateur</CardTitle>
            <CardBody>
              <p>Vous avez accès au back-office d’animation.</p>
              {/* The only link to /admin in the whole interface. Hiding it
                  from other participants is a courtesy, not a protection —
                  the layout, the middleware and the database each refuse the
                  access on their own. */}
              <p className="mt-3">
                <Link
                  href="/admin"
                  className="text-brand-blue underline underline-offset-4"
                >
                  Ouvrir le back-office
                </Link>
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </ParticipantShell>
  );
}
