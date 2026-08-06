import { Badge } from "@/components/ui/badge";
import type { AlbumCard } from "@/lib/cards/collection";
import type { Rarity } from "@/lib/cards/draw";
import { RARITY_LABELS } from "@/lib/cards/form";
import { cn } from "@/lib/cn";

/**
 * One card in the album, held or missing.
 *
 * **A missing card is drawn, not hidden.** An empty space you can see is
 * what makes somebody want to fill it; a list of what you already have makes
 * nobody want anything.
 *
 * **The rarity is never carried by colour alone.** Every tier has a word
 * beside its tint. Around one man in twelve has some form of colour vision
 * deficiency — on a men's health fundraiser, a collection legible only to
 * the other eleven would be a poor joke.
 *
 * **And it works before any visual exists.** The definitive images are a
 * September job; until then a card shows its initials on its rarity's tint,
 * and swapping in the real picture changes no code (story 5.4 AC 5).
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

export function CardFace({ card }: { card: AlbumCard }) {
  const owned = card.copies > 0;

  return (
    <figure
      className={cn(
        "border-line bg-surface overflow-hidden rounded-xl border",
        !owned && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex aspect-3/4 items-center justify-center",
          owned ? RARITY_FILL[card.rarity] : "bg-surface-sunken",
        )}
      >
        {owned && card.imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             The picture comes from storage at a size nobody controls, and
             the album shows a dozen at once. Next's optimiser would be one
             more moving part between a volunteer uploading a card and it
             appearing — for a screen where the images are small anyway. */
          <img
            src={card.imagePath}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden
            className="text-3xl font-extrabold tracking-tight opacity-70"
          >
            {owned ? initials(card.title) : "?"}
          </span>
        )}
      </div>

      <figcaption className="space-y-1 p-2">
        <p className="text-ink truncate text-sm font-medium">
          {owned ? card.title : "Carte à découvrir"}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={RARITY_TONE[card.rarity]}>
            {RARITY_LABELS[card.rarity]}
          </Badge>

          {card.copies > 1 && (
            <span className="text-ink-muted text-xs">×{card.copies}</span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

/** `Moustache du dimanche` → `MD`. Enough to tell two placeholders apart. */
function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
