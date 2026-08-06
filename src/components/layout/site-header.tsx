import Link from "next/link";

import { ROUTES } from "@/lib/auth/routes";

/**
 * Public site header.
 *
 * The wordmark is text, not an image: the project has its own identity and
 * uses no Movember Foundation logo or imagery (CLAUDE.md §5).
 *
 * **It carries the way in.** Until now it carried none: the public site had
 * no link to the sign-in page anywhere, so somebody who already had an
 * account could only get back to it by typing the address. The edition
 * label that used to sit here said something nobody needed twice — the
 * page below already says which edition it is.
 *
 * Deliberately session-free. This header is rendered on the statically
 * generated pages — home, legal notices, 404 — and reading the session
 * would make every one of them dynamic. `/connexion` redirects an
 * already-signed-in visitor onwards, so one link is correct in both states.
 */
export function SiteHeader() {
  return (
    <header className="border-line bg-surface border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-brand-blue text-xl font-extrabold tracking-tight">
            DEFI
          </span>
          <span className="text-brand-orange-ink text-xl font-extrabold tracking-tight">
            Movember
          </span>
        </Link>

        <Link
          href={ROUTES.signIn}
          className="text-ink hover:text-brand-blue min-h-11 px-2 py-2 text-sm font-medium underline underline-offset-4"
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}
