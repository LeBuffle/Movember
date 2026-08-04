import { RetryButton } from "@/components/pwa/retry-button";
import { Alert } from "@/components/ui/alert";

export const metadata = {
  title: "Hors ligne — DEFI Movember",
  robots: { index: false, follow: false },
};

/**
 * Shown when a page cannot be loaded for want of a network (story 1.8 AC 8).
 *
 * Held in the service worker's precache, which imposes two constraints:
 *
 * - it must render without any data from the server, so nothing here is
 *   fetched and nothing is personalised;
 * - it must not depend on the site header or footer, whose links all lead to
 *   pages that are equally unreachable offline. The independence notice is
 *   repeated inline instead (CLAUDE.md §5).
 *
 * The tone matters. A participant reaching this page is very often out
 * running, in a spot with no coverage, having just finished the day's
 * challenge. What they need to know is that nothing is lost: the challenge
 * is validated from the Strava activity, on the server, not from this
 * screen.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <p className="flex items-baseline gap-1.5">
        <span className="text-brand-blue text-xl font-extrabold tracking-tight">
          DEFI
        </span>
        <span className="text-brand-orange-ink text-xl font-extrabold tracking-tight">
          Movember
        </span>
      </p>

      <h1 className="text-ink mt-6 text-3xl font-bold tracking-tight">
        Pas de connexion
      </h1>

      <p className="text-ink-muted mt-3">
        Impossible de joindre l’application. Vérifiez votre connexion internet,
        puis réessayez.
      </p>

      <div className="mt-6">
        <Alert tone="info" title="Votre activité n’est pas perdue">
          Les défis sont validés à partir de vos activités Strava, sur nos
          serveurs. Rien ne dépend de cet écran : votre séance sera prise en
          compte dès que la connexion reviendra.
        </Alert>
      </div>

      <div className="mt-8">
        <RetryButton />
      </div>

      <p className="text-ink-muted mt-12 text-sm">
        Projet indépendant porté par une association loi 1901. Ce n’est pas
        l’application officielle de la fondation Movember.
      </p>
    </main>
  );
}
