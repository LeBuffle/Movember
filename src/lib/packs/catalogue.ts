import "server-only";

import type { Rarity } from "@/lib/cards/draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The packs on sale, read from the database (story 10.1).
 *
 * Same rule as the registration tiers, and for the same reason: **there is no
 * hard-coded fallback list.** A price kept in the code "for when the database
 * is unavailable" would show one amount while the payment charged another,
 * which is the single worst failure a shop can have. When the packs cannot be
 * read, the shop says so and sells nothing.
 *
 * Read through the participant's own session: the shop is inside the game,
 * and row level security is what says a signed-out visitor sees no packs.
 */

export type CardPack = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  /** Equal to the price, by database constraint. */
  donatedCents: number;
  cardCount: number;
  /** A floor, not a ceiling. Null means no guarantee. */
  guaranteedRarity: Rarity | null;
};

export async function getPacks(): Promise<CardPack[]> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    console.error("[packs] édition introuvable", { year: EDITION_YEAR });
    return [];
  }

  const { data, error } = await supabase
    .from("card_packs")
    .select(
      "id, slug, name, tagline, price_cents, donated_cents, card_count, guaranteed_rarity",
    )
    .eq("edition_id", edition.id)
    .eq("available", true)
    .order("position", { ascending: true });

  if (error || !data) {
    console.error("[packs] lecture impossible", { code: error?.code });
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    priceCents: row.price_cents,
    donatedCents: row.donated_cents,
    cardCount: row.card_count,
    guaranteedRarity: row.guaranteed_rarity as Rarity | null,
  }));
}

/**
 * One pack, by slug — the strict counterpart of the list above.
 *
 * This is the function the payment path uses, and it may not guess: a price
 * that cannot be read is a price that must not be charged. Returns `null`,
 * and the caller has to treat that as a refusal rather than a default.
 */
export async function getPackBySlug(slug: string): Promise<CardPack | null> {
  const packs = await getPacks();
  return packs.find((pack) => pack.slug === slug) ?? null;
}

/** How a guarantee is worded on screen. Never "aucune", which sounds like a loss. */
export function guaranteeLabel(rarity: Rarity | null): string | null {
  if (!rarity) return null;

  const labels: Record<Rarity, string> = {
    commune: "une carte commune garantie",
    rare: "une carte rare garantie",
    epique: "une carte épique garantie",
    legendaire: "une carte légendaire garantie",
  };

  return labels[rarity];
}
