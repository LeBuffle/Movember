import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { InstallState } from "@/components/pwa/install-state";
import { Alert } from "@/components/ui/alert";
import { APP_VERSION } from "@/lib/app-version";

/**
 * Provisional landing page.
 *
 * Replaced by the real public home page in story 1.9, which adds the pricing
 * tiers, the collection counter and the tax notice. Its job right now is to
 * show the design system on a real page.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-brand-orange-ink text-sm font-semibold tracking-widest uppercase">
          Novembre 2026
        </p>

        <h1 className="text-ink mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Un mois, un défi par jour,
          <br />
          une collection à compléter.
        </h1>

        <p className="text-ink-muted mt-4 text-lg">
          Vous faites déjà du sport. Reliez votre compte Strava, relevez le défi
          du jour, gagnez des cartes — et soutenez la cause.
        </p>

        <div className="mt-8">
          <Alert tone="info" title="Application en construction">
            Les inscriptions ouvriront à la mi-octobre 2026.
          </Alert>
        </div>

        {/*
          Diagnostic line, on the home page because that is the ONLY page an
          installed application can reach: it opens on `start_url` and has no
          address bar, so anything put anywhere else cannot be looked at from
          inside the installed app. Which is exactly where it needs to be
          looked at.

          Story 1.9 replaces this page. It must move this indicator to
          `/mon-compte` rather than drop it — epic 6 needs a way to answer
          "is this participant actually installed?" when someone reports
          never getting a notification.
        */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <p className="text-ink-muted font-mono text-xs">
            version {APP_VERSION}
          </p>
          <InstallState />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
