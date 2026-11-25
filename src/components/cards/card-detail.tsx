import { Badge } from "@/components/ui/badge";
import type { Rarity } from "@/lib/cards/draw";
import { RARITY_LABELS } from "@/lib/cards/form";
import type { RevealableCard } from "@/lib/cards/reveal";
import { cn } from "@/lib/cn";

/**
 * One card, shown large.
 *
 * The same component on the reveal screen and on the card's own page, so what
 * is discovered and what is found again in the album are the same object. Two
 * renderings would drift, and they would drift on the screen the whole
 * collection exists for.
 *
 * **The rarity is never carried by colour alone** (AC 3). Every tier shows
 * its word next to its tint. Around one man in twelve has some form of colour
 * vision deficiency — on a men's health fundraiser, a collection legible only
 * to the other eleven would be a poor joke.
 */

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

export function CardDetail({
  card,
  copies = 1,
}: {
  card: RevealableCard;
  copies?: number;
}) {
  return (
    <article className="border-line bg-surface mx-auto max-w-sm overflow-hidden rounded-2xl border">
      <div
        className={cn(
          "aspect-carte flex items-center justify-center",
          RARITY_FILL[card.rarity],
        )}
      >
        {card.imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             The picture comes from storage at a size nobody controls. The
             optimiser would be one more moving part between a volunteer
             uploading a card and a participant seeing it. */
          <img
            src={card.imagePath}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="text-6xl font-extrabold tracking-tight opacity-70"
          >
            {initials(card.title)}
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={RARITY_TONE[card.rarity]}>
            {RARITY_LABELS[card.rarity]}
          </Badge>

          {copies > 1 && <Badge tone="neutral">{copies} exemplaires</Badge>}
        </div>

        <h2 className="text-ink text-2xl font-bold tracking-tight">
          {card.title}
        </h2>

        {card.description && (
          <p className="text-ink-muted">{card.description}</p>
        )}

        <dl className="border-line divide-line divide-y border-t text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-ink-muted">Obtenue le</dt>
            <dd className="text-ink font-medium">
              {formatDate(card.grantedAt)}
            </dd>
          </div>

          <div className="flex justify-between gap-4 py-2">
            <dt className="text-ink-muted">Comment</dt>
            <dd className="text-ink text-right font-medium">
              {SOURCE_LABELS[card.source] ?? "Attribuée par l’organisation"}
            </dd>
          </div>
        </dl>

        {/* Said on the card itself, not only in the album's counters. A card
            from a pack enriches a collection and never improves a score, and
            the place somebody looks for that answer is here. */}
        <p className="text-ink-muted text-sm">
          {card.earned
            ? "Cette carte compte au classement collection."
            : "Les cartes des packs ne comptent pas au classement collection."}
        </p>
      </div>
    </article>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  challenge: "Défi réussi",
  daily_draw: "Tirage du jour",
  pack: "Pack bonus",
  purchase: "Achat",
  manual: "Attribuée par l’organisation",
};

function initials(title: string): string {
  const letters = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return letters || "?";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
