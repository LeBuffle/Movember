import { RARITY_ORDER, type Rarity } from "@/lib/cards/draw";
import { RARITY_LABELS } from "@/lib/cards/form";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * The published card catalogue, for anybody.
 *
 * **Read as `anon`, with no cookie and no session** — which is not a
 * convenience, it is the guarantee. This function cannot reach a collection,
 * a pseudonym or an e-mail address, because the client it uses has no
 * identity to reach them with, and row level security lets `anon` read
 * exactly one thing here: a card whose `published_at` is set (story 5.8 AC 2).
 *
 * The type below carries no participant field at all. There is nothing to
 * forget to strip, because there is nothing personal to begin with.
 */

export type GalleryCard = {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  imagePath: string;
};

export type Gallery = {
  groups: Array<{ rarity: Rarity; label: string; cards: GalleryCard[] }>;
  total: number;
  /** True when the catalogue could not be read, as opposed to being empty. */
  failed: boolean;
};

const EMPTY: Gallery = { groups: [], total: 0, failed: false };

export async function getGallery(): Promise<Gallery> {
  const supabase = createAnonClient();
  if (!supabase) return { ...EMPTY, failed: true };

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return EMPTY;

  const { data, error } = await supabase
    .from("cards")
    .select("id, title, description, rarity, image_path")
    .eq("edition_id", edition.id)
    // Belt as well as braces. The policy already refuses an unpublished card
    // to `anon`; stating it here too means a policy loosened one day does not
    // silently turn this page into a spoiler.
    .not("published_at", "is", null)
    .order("title");

  if (error) {
    console.error("[cartes] galerie illisible", { code: error.code });
    return { ...EMPTY, failed: true };
  }

  const cards: GalleryCard[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    rarity: row.rarity as Rarity,
    imagePath: row.image_path,
  }));

  return {
    // Rarest last, unlike the album: a visitor scrolls to the end and lands
    // on the legendary, which is the one that makes somebody want to play.
    groups: RARITY_ORDER.map((rarity) => ({
      rarity,
      label: RARITY_LABELS[rarity],
      cards: cards.filter((card) => card.rarity === rarity),
    })).filter((group) => group.cards.length > 0),
    total: cards.length,
    failed: false,
  };
}
