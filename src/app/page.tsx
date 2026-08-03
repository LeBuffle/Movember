import { APP_VERSION } from "@/lib/app-version";

/**
 * Provisional landing page.
 *
 * Replaced by the real public home page in story 1.9, once the design system
 * from story 1.5 is available. Its only job right now is to prove the app is
 * built, deployed and served.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-neutral-500 uppercase">
        Édition 2026
      </p>

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        DEFI Movember
      </h1>

      <p className="text-lg text-neutral-700">
        Un mois, un défi par jour, une collection à compléter.
      </p>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="font-medium">Application en construction</p>
        <p className="mt-1 text-sm text-neutral-600">
          Le site ouvrira aux inscriptions à la mi-octobre 2026.
        </p>
      </div>

      <footer className="mt-8 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
        <p>
          Projet indépendant porté par une association loi 1901. Ce site n’est
          pas l’application officielle de la fondation Movember.
        </p>
        <p className="mt-2 font-mono text-xs">version {APP_VERSION}</p>
      </footer>
    </main>
  );
}
