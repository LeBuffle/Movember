"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/**
 * The floating tab bar — the way around the game.
 *
 * **Six screens existed with no way to get from one to another.** Each was
 * reachable only by a "Le jeu" link written by hand at the top of the page,
 * so the application read as a set of pages rather than as an application.
 * The Product Owner put it plainly the first time he used it: "ça fait pas
 * vraiment des menus".
 *
 * At the bottom, and floating, because this is used on a phone in November:
 * the thumb reaches the bottom of the screen, not the top, and a bar that is
 * always there says permanently what the application contains. Somebody who
 * has never seen the collection screen cannot want to open it.
 *
 * Five tabs, and five is the ceiling: a sixth makes each target too narrow
 * for a thumb at 375 px. Which five is a product decision — the four pillars
 * of the game plus the account. The dashboard, the news feed and the history
 * are reached from within, because they are read occasionally rather than
 * several times a day.
 *
 * Icons are inline SVG, drawn from the same 24×24 grid, rather than an icon
 * package: five icons do not justify a dependency, and a stroke that matches
 * across all five matters more than the drawing itself.
 */

type Tab = {
  href: string;
  label: string;
  /** Also matches the sub-pages, so a card's detail keeps its tab lit. */
  match: string;
  icon: (active: boolean) => React.ReactNode;
};

const stroke = {
  fill: "none",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    href: "/jeu",
    label: "Défi",
    match: "/jeu",
    icon: (active) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" {...stroke} />
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.25 : 0}
        />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/jeu/collection",
    label: "Collection",
    match: "/jeu/collection",
    icon: (active) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <rect
          x="7.5"
          y="4"
          width="12"
          height="16"
          rx="2"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.2 : 0}
        />
        <path d="M4.5 7v11a2 2 0 0 0 2 2" stroke="currentColor" {...stroke} />
      </svg>
    ),
  },
  {
    href: "/jeu/classement",
    label: "Classement",
    match: "/jeu/classement",
    icon: (active) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <rect
          x="3.5"
          y="12"
          width="5"
          height="8"
          rx="1"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.2 : 0}
        />
        <rect
          x="9.5"
          y="7"
          width="5"
          height="13"
          rx="1"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.35 : 0}
        />
        <rect
          x="15.5"
          y="10"
          width="5"
          height="10"
          rx="1"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.2 : 0}
        />
      </svg>
    ),
  },
  {
    href: "/jeu/equipe",
    label: "Équipe",
    match: "/jeu/equipe",
    icon: (active) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <circle
          cx="9"
          cy="9"
          r="3.2"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.25 : 0}
        />
        <path
          d="M3.5 19c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8"
          stroke="currentColor"
          {...stroke}
        />
        <circle cx="16.5" cy="7.5" r="2.4" stroke="currentColor" {...stroke} />
        <path
          d="M16 13.4c2.6.2 4.5 1.9 4.5 4.6"
          stroke="currentColor"
          {...stroke}
        />
      </svg>
    ),
  },
  {
    href: "/mon-compte",
    label: "Moi",
    match: "/mon-compte",
    icon: (active) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
        <circle
          cx="12"
          cy="8"
          r="3.6"
          stroke="currentColor"
          {...stroke}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.25 : 0}
        />
        <path
          d="M4.5 20c0-3.6 3.3-5.8 7.5-5.8s7.5 2.2 7.5 5.8"
          stroke="currentColor"
          {...stroke}
        />
      </svg>
    ),
  },
];

/**
 * Which tab is lit.
 *
 * Longest match wins, so `/jeu/collection/reveler` lights Collection rather
 * than Défi — `/jeu` is a prefix of every game route and would otherwise
 * always win.
 */
export function activeTab(pathname: string): string | null {
  const candidates = TABS.filter(
    (tab) => pathname === tab.match || pathname.startsWith(`${tab.match}/`),
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((longest, tab) =>
    tab.match.length > longest.match.length ? tab : longest,
  ).href;
}

export function ParticipantTabs() {
  const pathname = usePathname();
  const current = activeTab(pathname);

  return (
    <nav
      aria-label="Navigation principale"
      /* `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of the home
         indicator on an iPhone. Without it the labels sit under the gesture
         area, where a tap is swallowed. */
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul
        className={cn(
          "border-line bg-surface/85 flex w-full max-w-md items-stretch justify-between",
          "rounded-full border p-1.5 shadow-lg backdrop-blur-md",
        )}
      >
        {TABS.map((tab) => {
          const active = current === tab.href;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5",
                  "text-[0.6875rem] leading-tight font-medium transition-colors",
                  active
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {tab.icon(active)}
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
