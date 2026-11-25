import "server-only";

import { RARITY_ORDER, type Rarity } from "@/lib/cards/draw";
import type { CardFilters } from "@/lib/cards/form";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading the card catalogue, from the back-office.
 *
 * Through the administrator's own session. Row level security then answers:
 * `cards` carries a policy letting an admin read the whole catalogue, and one
 * letting everybody else read only what is published — so an unpublished card
 * cannot leak through a page that forgot a filter.
 */

export type AdminCard = {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  imagePath: string;
  publishedAt: string | null;
};

/**
 * One card, with the figure the deletion decision needs.
 *
 * Counted on the card's own screen and nowhere else: on the list it would
 * mean reading every grant of the edition — nine thousand rows by the end of
 * November — to show a number nobody acts on from there.
 */
export type AdminCardDetail = AdminCard & {
  /** How many copies are in circulation. */
  grants: number;
};

export type CatalogueView = {
  cards: AdminCard[];
  /** Counted over the whole catalogue, never over the filtered view. */
  totals: { published: number; draft: number };
  editionId: string | null;
  failed: boolean;
};

const EMPTY: CatalogueView = {
  cards: [],
  totals: { published: 0, draft: 0 },
  editionId: null,
  failed: false,
};

async function editionId(): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  return data?.id ?? null;
}

export async function listCards(filters: CardFilters): Promise<CatalogueView> {
  const edition = await editionId();
  if (!edition) return EMPTY;

  const supabase = await createClient();

  let query = supabase
    .from("cards")
    .select("id, title, description, rarity, image_path, published_at")
    .eq("edition_id", edition)
    // Drafts first: they are the ones that need something done to them.
    .order("published_at", { ascending: true, nullsFirst: true })
    .order("title")
    .limit(300);

  if (filters.status === "published") {
    query = query.not("published_at", "is", null);
  }
  if (filters.status === "draft") {
    query = query.is("published_at", null);
  }
  if (filters.rarity) query = query.eq("rarity", filters.rarity);

  const [listed, published, drafted] = await Promise.all([
    query,
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition)
      .not("published_at", "is", null),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition)
      .is("published_at", null),
  ]);

  if (listed.error) {
    console.error("[cartes] catalogue illisible", { code: listed.error.code });
    return { ...EMPTY, editionId: edition, failed: true };
  }

  const rows = listed.data ?? [];

  return {
    cards: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      rarity: row.rarity as Rarity,
      imagePath: row.image_path,
      publishedAt: row.published_at,
    })),
    totals: { published: published.count ?? 0, draft: drafted.count ?? 0 },
    editionId: edition,
    failed: false,
  };
}

/** One card, with the count that decides whether it can still be removed. */
export async function getCard(id: string): Promise<AdminCardDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cards")
    .select("id, title, description, rarity, image_path, published_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const { count } = await supabase
    .from("card_grants")
    .select("id", { count: "exact", head: true })
    .eq("card_id", id);

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    rarity: data.rarity as Rarity,
    imagePath: data.image_path,
    publishedAt: data.published_at,
    grants: count ?? 0,
  };
}

export type RarityLine = {
  slug: Rarity;
  label: string;
  weight: number;
  /** Published cards of that rarity. A weight with no card never comes out. */
  published: number;
};

/**
 * The weights, each next to what it can actually give.
 *
 * **The count is the point of this screen, not the weight.** A rarity with a
 * weight of 10 and no published card never comes out — the draw filters empty
 * rarities before rolling, precisely so the announced odds stay true (story
 * 5.2) — and from the back-office that is invisible unless it is written
 * down. In September, with the visuals arriving one at a time, that is the
 * normal state of three rarities out of four.
 */
export async function rarityBoard(): Promise<RarityLine[]> {
  const edition = await editionId();
  const supabase = await createClient();

  const { data: rarities } = await supabase
    .from("card_rarities")
    .select("slug, label, weight")
    .order("rank");

  const counts = new Map<string, number>();

  if (edition) {
    const { data: cards } = await supabase
      .from("cards")
      .select("rarity")
      .eq("edition_id", edition)
      .not("published_at", "is", null);

    for (const card of cards ?? []) {
      counts.set(card.rarity, (counts.get(card.rarity) ?? 0) + 1);
    }
  }

  const byslug = new Map((rarities ?? []).map((row) => [row.slug, row]));

  return RARITY_ORDER.map((slug) => ({
    slug,
    label: byslug.get(slug)?.label ?? slug,
    weight: byslug.get(slug)?.weight ?? 0,
    published: counts.get(slug) ?? 0,
  }));
}
