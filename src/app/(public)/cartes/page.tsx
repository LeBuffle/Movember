import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import type { Rarity } from "@/lib/cards/draw";
import { RARITY_LABELS } from "@/lib/cards/form";
import type { GalleryCard } from "@/lib/cards/gallery";
import { getPublicGallery } from "@/lib/public-cache";
import { cn } from "@/lib/cn";
import { EDITION_YEAR } from "@/lib/edition/calendar";

export const metadata: Metadata = {
  title: "Les cartes à collectionner — DEFI Movember",
  description:
    `Le jeu de cartes moustachues de l’édition ${EDITION_YEAR} : une carte ` +
    "tirée au sort à chaque défi réussi, de la commune à la légendaire. " +
    "Projet indépendant porté par une association loi 1901.",
};

/**
 * Regenerated at most every ten minutes.
 *
 * A public page read far more often than it changes. Ten minutes means a card
 * published from the back-office shows up here almost at once, and a thousand
 * visitors cost one query.
 */
// Rendered per request, query cached for ten minutes — see the home page
// and `lib/public-cache.ts`. With `revalidate` this page was prerendered at
// build time, with no database, and shipped an empty gallery.
export const dynamic = "force-dynamic";

/**
 * The public gallery.
 *
 * **It serves the fundraising, not the game** (priority S). Its job is to make
 * somebody who landed on the site want to register, by showing what there is
 * to collect. That is also why it is worth little until the visuals exist: a
 * gallery of grey silhouettes attracts nobody.
 *
 * **Nothing personal, by construction rather than by filtering.** The data
 * comes from an anonymous client with no session, and the type it returns has
 * no participant field. There is no collection to reach from here, no
 * pseudonym, no count of who owns what — not because they are stripped out,
 * but because they were never fetched (AC 2).
 */
export default async function GalleryPage() {
  const gallery = await getPublicGallery();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-12">
        <div>
          <h1 className="text-ink text-3xl font-extrabold tracking-tight sm:text-4xl">
            Les cartes à collectionner
          </h1>

          <p className="text-ink-muted mt-4 text-lg">
            Chaque défi réussi vous fait gagner une carte, tirée au sort.
            Certaines sortent presque à chaque fois, d’autres presque jamais —
            et c’est tout l’intérêt. Édition {EDITION_YEAR}.
          </p>
        </div>

        {gallery.failed && (
          <Alert
            tone="warning"
            title="Les cartes ne peuvent pas être affichées"
          >
            Réessayez dans quelques minutes. Le reste du site fonctionne
            normalement.
          </Alert>
        )}

        {!gallery.failed && gallery.total === 0 && (
          <Alert tone="info" title="Les cartes arrivent">
            Le jeu de cartes est en cours de création. Revenez avant le 1ᵉʳ
            novembre pour le découvrir.
          </Alert>
        )}

        {gallery.groups.map((group) => (
          <section key={group.rarity} className="space-y-4">
            <div>
              <h2 className="text-ink text-2xl font-bold">{group.label}</h2>
              <p className="text-ink-muted mt-1 text-sm">
                {RARITY_BLURB[group.rarity]} — {group.cards.length} carte
                {group.cards.length > 1 ? "s" : ""}.
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {group.cards.map((card) => (
                <li key={card.id}>
                  <GalleryFace card={card} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* The point of the page. Somebody who scrolled to the bottom of a
            gallery has already decided they like it; the next step has to be
            right there rather than back at the top. */}
        <section className="border-line bg-surface-sunken space-y-3 rounded-2xl border p-6 text-center">
          <h2 className="text-ink text-xl font-bold">
            Les cartes se gagnent en bougeant
          </h2>
          <p className="text-ink-muted">
            Un défi par jour pendant tout novembre, validé automatiquement par
            vos sorties. L’inscription finance la collecte — et aucune carte ne
            s’achète pour améliorer un classement.
          </p>
          <p>
            <Link href="/" className={buttonClasses()}>
              Comment participer
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/** One sentence per rarity, in words rather than in percentages. */
const RARITY_BLURB: Record<Rarity, string> = {
  commune: "Les plus fréquentes",
  rare: "Moins courantes",
  epique: "Peu de chances de la croiser",
  legendaire: "La plus rare du jeu",
};

const RARITY_TONE: Record<Rarity, "neutral" | "blue" | "orange" | "success"> = {
  commune: "neutral",
  rare: "blue",
  epique: "orange",
  legendaire: "success",
};

/** Placeholder tints, distinguishable in greyscale as well as in colour. */
const RARITY_FILL: Record<Rarity, string> = {
  commune: "bg-surface-sunken text-ink-muted",
  rare: "bg-brand-blue-soft text-brand-blue",
  epique: "bg-brand-orange-soft text-brand-orange-ink",
  legendaire: "bg-success-soft text-success",
};

/**
 * A card, shown to somebody who owns nothing.
 *
 * Everything is visible: there is no "to be discovered" state here. Hiding a
 * card from a visitor would be hiding the argument.
 *
 * The rarity carries its word beside its tint, as everywhere else — around one
 * man in twelve has some form of colour vision deficiency, and this is a
 * fundraiser for men's health.
 */
function GalleryFace({ card }: { card: GalleryCard }) {
  return (
    <figure className="border-line bg-surface overflow-hidden rounded-xl border">
      <div
        className={cn(
          "aspect-carte flex items-center justify-center",
          RARITY_FILL[card.rarity],
        )}
      >
        {card.imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             Served straight from storage, on a page regenerated every ten
             minutes and cached. The optimiser would add a moving part
             between a volunteer publishing a card and a visitor seeing it. */
          <img
            src={card.imagePath}
            alt={card.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden
            className="text-3xl font-extrabold tracking-tight opacity-70"
          >
            {initials(card.title)}
          </span>
        )}
      </div>

      <figcaption className="space-y-1 p-2">
        <p className="text-ink truncate text-sm font-medium">{card.title}</p>
        <Badge tone={RARITY_TONE[card.rarity]}>
          {RARITY_LABELS[card.rarity]}
        </Badge>
      </figcaption>
    </figure>
  );
}

function initials(title: string): string {
  const letters = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return letters || "?";
}
