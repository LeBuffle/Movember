import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
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

        <p className="text-ink-muted mt-10 font-mono text-xs">
          version {APP_VERSION}
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
