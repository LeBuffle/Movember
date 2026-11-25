"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { cn } from "@/lib/cn";

/**
 * Back-office navigation.
 *
 * Pills that wrap, rather than a sidebar collapsing into a burger menu. The
 * reason is AC 6, and it is not a style preference: the organising team will
 * animate the game from their phones, in short bursts, and epic 8 sets the
 * bar at "a non-technical volunteer creates a challenge from their phone,
 * unaided". A menu that must be opened before anything can be reached costs
 * a tap on every navigation, and needs JavaScript to have loaded to work at
 * all. Eight short labels wrap into three rows on a 390 px screen:
 * everything visible, everything one tap away, no state to get wrong.
 *
 * A client component only so that `usePathname` can mark the open section.
 * The alternative — passing the current slug down from each page — means
 * every future section has to remember to do it, and one of them will not.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections du back-office">
      <ul className="flex flex-wrap gap-2">
        <li>
          <NavPill href="/admin" active={pathname === "/admin"}>
            Accueil
          </NavPill>
        </li>
        <li>
          {/* Not in `ADMIN_SECTIONS`: that list is the map of the game's
              sections, delivered epic by epic. This one is a diagnostic
              screen, and it belongs beside them rather than among them. */}
          <NavPill href="/admin/etat" active={pathname === "/admin/etat"}>
            État
          </NavPill>
        </li>
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.slug}>
            <NavPill
              href={`/admin/${section.slug}`}
              active={pathname === `/admin/${section.slug}`}
            >
              {section.label}
            </NavPill>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      // `aria-current` rather than colour alone: the open section has to be
      // announced, not merely tinted (story 1.5 AC 6).
      aria-current={active ? "page" : undefined}
      className={cn(
        // min-h-11 keeps every pill at a comfortable touch target.
        "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium",
        "transition-colors",
        active
          ? "bg-brand-blue text-white"
          : "bg-surface-sunken text-ink-muted border-line hover:bg-brand-blue-soft border",
      )}
    >
      {children}
    </Link>
  );
}
