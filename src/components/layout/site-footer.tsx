import Link from "next/link";

/**
 * Public site footer.
 *
 * Carries the independence notice, which is a hard requirement of the
 * project (CLAUDE.md §5): no part of the interface may suggest this is the
 * Movember Foundation's official application.
 *
 * The tax notice ("these are not tax-deductible donations") also has to be
 * unmissable, but it belongs above the fold on the pages where money is
 * involved — it is added to the home page in story 1.9 and to the payment
 * flow in epic 2. A footer alone would not satisfy CLAUDE.md §6.
 */
export function SiteFooter() {
  return (
    <footer className="border-line bg-surface-sunken mt-16 border-t">
      <div className="text-ink-muted mx-auto max-w-5xl space-y-4 px-4 py-8 text-sm">
        <p>
          Projet indépendant porté par une association loi 1901. Ce site n’est
          pas l’application officielle de la fondation Movember et n’utilise
          aucun de ses logos ou visuels.
        </p>

        <nav aria-label="Informations légales">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/cgv" className="underline underline-offset-4">
                Conditions générales de vente
              </Link>
            </li>
            <li>
              <Link
                href="/confidentialite"
                className="underline underline-offset-4"
              >
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link
                href="/mentions-legales"
                className="underline underline-offset-4"
              >
                Mentions légales
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
