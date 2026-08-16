import "server-only";

import { RARITY_ORDER, type Rarity } from "@/lib/cards/draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * A participant's album.
 *
 * Read through their own session, so row level security answers — a
 * published card is public, a grant is not.
 *
 * **The two counters are the most important thing on this screen.** Somebody
 * who buys two packs has a fuller collection, not a better score, and the
 * labels have to say so rather than imply it. Getting this wrong would ruin
 * the readability of the ranking, which is the one thing the whole `source`
 * column exists to protect (architecture D8, NFR20).
 */

export type AlbumCard = {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  imagePath: string;
  /** How many copies. 0 means "not obtained yet" — shown in outline. */
  copies: number;
  /** Whether at least one copy was earned rather than received in a pack. */
  earned: boolean;
  firstGrantedAt: string | null;
};

export type Album = {
  /** Grouped in rarity order, commonest first. */
  groups: Array<{ rarity: Rarity; label: string; cards: AlbumCard[] }>;
  counters: {
    /** Distinct cards obtained by playing. **This is the one that ranks.** */
    earned: number;
    /** Distinct cards held, packs and purchases included. */
    collected: number;
    /** How many exist to be found. */
    total: number;
  };
};

/** Sources that count towards the ranking (architecture D8). */
const EARNING_SOURCES = new Set(["challenge", "daily_draw"]);

const EMPTY: Album = {
  groups: [],
  counters: { earned: 0, collected: 0, total: 0 },
};

export async function getAlbum(): Promise<Album> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY;

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return EMPTY;

  const [catalogue, grants, rarities] = await Promise.all([
    supabase
      .from("cards")
      .select("id, title, description, rarity, image_path")
      .eq("edition_id", edition.id)
      .not("published_at", "is", null)
      .order("title"),
    supabase
      .from("card_grants")
      .select("card_id, source, granted_at")
      .eq("profile_id", user.id)
      .eq("edition_id", edition.id)
      // Only what has been opened (story 5.5). A card visible in the album
      // before its reveal would spoil the one moment the reveal exists for —
      // and the screen says so, so nobody wonders where their card went.
      .not("revealed_at", "is", null),
    supabase.from("card_rarities").select("slug, label"),
  ]);

  if (catalogue.error) {
    console.error("[cartes] album illisible", { code: catalogue.error.code });
    return EMPTY;
  }

  const held = new Map<
    string,
    { copies: number; earned: boolean; first: string }
  >();

  for (const grant of grants.data ?? []) {
    const current = held.get(grant.card_id);
    const earned = EARNING_SOURCES.has(grant.source);

    if (!current) {
      held.set(grant.card_id, {
        copies: 1,
        earned,
        first: grant.granted_at,
      });
      continue;
    }

    current.copies += 1;
    current.earned ||= earned;
    if (grant.granted_at < current.first) current.first = grant.granted_at;
  }

  const labels = new Map(
    (rarities.data ?? []).map((rarity) => [rarity.slug, rarity.label]),
  );

  const cards: AlbumCard[] = (catalogue.data ?? []).map((card) => {
    const owned = held.get(card.id);

    return {
      id: card.id,
      title: card.title,
      description: card.description,
      rarity: card.rarity as Rarity,
      imagePath: card.image_path,
      copies: owned?.copies ?? 0,
      earned: owned?.earned ?? false,
      firstGrantedAt: owned?.first ?? null,
    };
  });

  const groups = RARITY_ORDER.map((rarity) => ({
    rarity,
    label: labels.get(rarity) ?? rarity,
    cards: cards.filter((card) => card.rarity === rarity),
  })).filter((group) => group.cards.length > 0);

  return {
    groups,
    counters: {
      // Distinct cards, not grants: three copies of the same card is one
      // card in a collection, and counting copies would let somebody rank
      // by luck rather than by playing.
      earned: cards.filter((card) => card.earned).length,
      collected: cards.filter((card) => card.copies > 0).length,
      total: cards.length,
    },
  };
}
