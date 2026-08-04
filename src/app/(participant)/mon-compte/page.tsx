import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountForm } from "@/components/auth/account-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { InstallState } from "@/components/pwa/install-state";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
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

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Mon compte
        </h1>

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
          <CardTitle>Application installée</CardTitle>
          <CardBody>
            <p>
              Sur iPhone, les notifications quotidiennes ne fonctionnent que si
              l’application a été ajoutée à l’écran d’accueil.
            </p>
            <div className="mt-3">
              <InstallState />
            </div>
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
      </main>

      <SiteFooter />
    </>
  );
}
