import Link from "next/link";

/**
 * Public site header.
 *
 * The wordmark is text, not an image: the project has its own identity and
 * uses no Movember Foundation logo or imagery (CLAUDE.md §5).
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

        <p className="text-ink-muted text-sm font-medium">Édition 2026</p>
      </div>
    </header>
  );
}
