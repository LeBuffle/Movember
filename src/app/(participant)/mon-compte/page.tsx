import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountForm } from "@/components/auth/account-form";
import { ParticipantShell } from "@/components/layout/participant-shell";
import { InstallState } from "@/components/pwa/install-state";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { AddressReminder } from "@/components/shipping/address-reminder";
import { ROUTES } from "@/lib/auth/routes";
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
    .select("display_name, email, role")
    .eq("id", user.id)
    .single();

  // Only asks of those who actually have something coming (story 2.7).
  const [shipping, access] = await Promise.all([
    getShippingContext(),
    getParticipantAccess(),
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
          <div className="mt-4">
            <AccountForm displayName={profile?.display_name ?? ""} />
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
