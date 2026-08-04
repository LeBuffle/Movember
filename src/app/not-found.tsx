import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata = {
  title: "Page introuvable — DEFI Movember",
  robots: { index: false, follow: false },
};

/**
 * The site's not-found page.
 *
 * Replaces Next's default, which is in English and carries none of the
 * project's identity. It is reached more often than a 404 page usually is,
 * because it is also the answer given to someone without the administrator
 * role who tries to open the back-office (story 1.10 AC 2) — a refusal that
 * must be clear without revealing what it is refusing.
 *
 * Hence the wording: it says the page does not exist, offers the way back,
 * and mentions nothing about roles or permissions. Someone probing for
 * `/admin` learns exactly what someone mistyping a URL learns.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-4 py-20">
        <p className="text-brand-orange-ink text-sm font-semibold tracking-widest uppercase">
          Erreur 404
        </p>

        <h1 className="text-ink mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Cette page n’existe pas
        </h1>

        <p className="text-ink-muted mt-4">
          Le lien est peut-être erroné, ou la page a été déplacée.
        </p>

        <p className="mt-8">
          <Link
            href="/"
            className="text-brand-blue underline underline-offset-4"
          >
            Retour à l’accueil
          </Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
