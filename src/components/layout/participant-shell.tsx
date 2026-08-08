import Link from "next/link";

import { ParticipantTabs } from "@/components/layout/participant-tabs";
import { cn } from "@/lib/cn";

/**
 * The frame every participant screen sits in.
 *
 * Three things it does, and each replaces something that was written by hand
 * on six separate screens:
 *
 * 1. **A tinted band at the top**, carrying the screen's title and whatever
 *    number matters there. It gives each screen a horizon instead of a
 *    heading floating on white, and it is where the eye lands first.
 * 2. **A sunken page behind white cards**, rather than white on white. It is
 *    what makes a card look like a card.
 * 3. **The tab bar**, and the bottom padding that stops it covering the last
 *    row of content — the mistake that makes a floating bar hated.
 *
 * Blue-soft rather than the solid brand blue for the band: `#eff6ff` carries
 * ordinary dark text at full contrast, where a solid blue would force white
 * text and a second set of rules for every element placed on it.
 */
export function ParticipantShell({
  title,
  intro,
  eyebrow,
  aside,
  tabs = true,
  children,
}: {
  title: string;
  /** One sentence under the title. Optional — most screens need none. */
  intro?: string;
  /** Small label above the title: the date, the edition, the category. */
  eyebrow?: string;
  /** Anything the band should carry on the right: a figure, a badge. */
  aside?: React.ReactNode;
  /**
   * Whether to show the tab bar. Off for somebody signed in without an
   * active registration: every tab but one would bounce them straight back
   * to the registration screen, which reads as a broken application rather
   * than as a gate.
   */
  tabs?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-sunken min-h-screen">
      <header className="bg-brand-blue-soft">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-brand-blue text-xs font-semibold tracking-widest uppercase">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-ink mt-1 text-3xl font-extrabold tracking-tight">
                {title}
              </h1>
              {intro && <p className="text-ink-muted mt-2">{intro}</p>}
            </div>

            {aside && <div className="shrink-0 text-right">{aside}</div>}
          </div>
        </div>
      </header>

      {/* Pulled up over the band, the way a sheet overlaps a header. The
          bottom padding clears the floating tab bar — content hidden behind
          it is the classic failure of this pattern. */}
      <main
        id="contenu"
        className={cn(
          "mx-auto w-full max-w-3xl px-4",
          tabs ? "pb-32" : "pb-16",
        )}
      >
        <div className="-mt-6 space-y-4">{children}</div>
      </main>

      {tabs && <ParticipantTabs />}
    </div>
  );
}

/**
 * A section heading, optionally with the link that shows the rest.
 *
 * The "Tout voir" on the right is what lets a screen show three of something
 * instead of forty without the three looking like all there is.
 */
export function SectionHeading({
  children,
  href,
  action = "Tout voir",
}: {
  children: React.ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-2">
      <h2 className="text-ink text-lg font-bold">{children}</h2>
      {href && (
        <Link
          href={href}
          className="text-brand-blue shrink-0 text-sm font-semibold"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

/**
 * A row of figures, the way an application states what somebody has done.
 *
 * Big number, small label underneath. It is the difference between reading a
 * total and seeing it — and it is the one element of this style that carries
 * over to every screen of the game.
 */
export function StatRow({
  stats,
}: {
  stats: { value: string; label: string; href?: string }[];
}) {
  return (
    <div className="border-line bg-surface flex items-stretch rounded-2xl border">
      {stats.map((stat, index) => {
        const body = (
          <>
            <span className="text-ink block text-2xl font-extrabold">
              {stat.value}
            </span>
            <span className="text-ink-muted mt-0.5 block text-xs">
              {stat.label}
            </span>
          </>
        );

        return (
          <div
            key={stat.label}
            className={cn(
              "flex-1 px-2 py-4 text-center",
              index > 0 && "border-line border-l",
            )}
          >
            {stat.href ? (
              <Link href={stat.href} className="block">
                {body}
              </Link>
            ) : (
              body
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A progress bar with its two ends named.
 *
 * Always labelled: a bare bar says "some of something" and is read as
 * decoration. `role="img"` with a text label is what makes it mean the same
 * thing to a screen reader as it does to an eye.
 */
export function ProgressBar({
  value,
  max,
  label,
  left,
  right,
}: {
  value: number;
  max: number;
  label: string;
  left?: string;
  right?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div>
      <div
        role="img"
        aria-label={label}
        className="bg-surface-sunken h-2.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-brand-orange h-full rounded-full transition-[width]"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      {(left || right) && (
        <div className="text-ink-muted mt-1.5 flex justify-between text-xs">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A white panel. The unit everything on these screens is made of.
 */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("border-line bg-surface rounded-2xl border p-4", className)}
    >
      {children}
    </section>
  );
}

/**
 * A horizontally scrolling row.
 *
 * Cards, news, teammates: anything there are more of than fit. Scrolls
 * inside itself so the page never scrolls sideways, which on a phone reads
 * as a broken layout.
 */
export function Carousel({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-3 pb-1">{children}</div>
    </div>
  );
}
