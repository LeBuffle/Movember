import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { InstallGuide } from "@/components/pwa/install-guide";
import { buttonClasses } from "@/components/ui/button";

export const metadata = {
  title: "Installer l’application — DEFI Movember",
  robots: { index: false, follow: false },
};

/**
 * The installation step of the registration journey.
 *
 * **A step, not a suggestion made in passing** (story 6.2 AC 3). It is the
 * project's largest non-technical risk: on iPhone no web notification exists
 * outside an installed application, and a participant who never installs
 * never hears about their daily challenge — the one thing that brings people
 * back (risk T5).
 *
 * It can still be skipped, and the way out is a plain link rather than a
 * hidden one. Somebody registering on a borrowed computer cannot follow these
 * steps right now, and blocking them at a payment confirmation would cost a
 * registration to save a notification. The reminder on the game screen brings
 * the question back.
 *
 * Rendered by the server with no session read: it says the same thing to
 * everybody, and the only per-device part is decided in the browser.
 */
export default function InstallPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">
            Installer l’application
          </h1>
          <p className="text-ink-muted mt-3">
            Chaque matin, le jeu vous envoie votre défi du jour. Pour que cette
            notification arrive, l’application doit être ajoutée à votre écran
            d’accueil.
          </p>
        </div>

        <InstallGuide />

        <div className="border-line flex flex-wrap gap-3 border-t pt-6">
          <Link href="/jeu" className={buttonClasses()}>
            C’est fait, aller au jeu
          </Link>

          <Link href="/jeu" className={buttonClasses({ variant: "ghost" })}>
            Plus tard
          </Link>
        </div>

        <p className="text-ink-muted text-sm">
          Vous pouvez revenir ici à tout moment depuis « Mon compte ». Sans
          installation, l’essentiel vous sera envoyé par e-mail — mais vous
          manquerez les notifications de défi validé.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
