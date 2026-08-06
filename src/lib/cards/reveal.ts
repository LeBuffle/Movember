import "server-only";

import type { Rarity } from "@/lib/cards/draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The cards waiting to be discovered.
 *
 * Challenges validate themselves from the activities that arrive; nobody
 * presses anything, and that is the right design. It costs the one thing a
 * collection lives on — the moment of opening — and this is what puts it
 * back.
 *
 * Read through the participant's own session: a grant is theirs and nobody
 * else's, and row level security is what says so.
 *
 * The card and its grant are read in two queries rather than joined, like the
 * album does. Two round trips on a screen that shows one card is not what
 * makes it slow, and the hand-written database types describe no relations —
 * a join here would be untyped, which on the screen that decides what a
 * participant is allowed to see is not a trade worth making.
 */

export type RevealableCard = {
  /** The grant, not the card: two copies are two separate moments. */
  grantId: string;
  cardId: string;
  title: string;
  description: string;
  rarity: Rarity;
  imagePath: string;
  grantedAt: string;
  source: string;
  /** Whether this copy was earned by playing rather than opened in a pack. */
  earned: boolean;
};

/** Sources that count towards the ranking (architecture D8). */
const EARNING_SOURCES = new Set(["challenge", "daily_draw"]);

type Grant = {
  id: string;
  card_id: string;
  source: string;
  granted_at: string;
};

async function loadCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  grant: Grant,
): Promise<RevealableCard | null> {
  const { data } = await supabase
    .from("cards")
    .select("title, description, rarity, image_path")
    .eq("id", grant.card_id)
    .maybeSingle();

  // Unpublished between the grant and the moment it is opened: the card is
  // still in the album — it was earned — but there is nothing to show. The
  // caller treats a null as "nothing to reveal" rather than crashing.
  if (!data) return null;

  return {
    grantId: grant.id,
    cardId: grant.card_id,
    title: data.title,
    description: data.description,
    rarity: data.rarity as Rarity,
    imagePath: data.image_path,
    grantedAt: grant.granted_at,
    source: grant.source,
    earned: EARNING_SOURCES.has(grant.source),
  };
}

/**
 * How many cards are waiting.
 *
 * Shown on the game screen, which is the one opened every morning — a
 * discovery nobody is told about is a discovery nobody makes.
 */
export async function pendingRevealCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("card_grants")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .is("revealed_at", null);

  return count ?? 0;
}

/** The next one to open, oldest first, with what still follows it. */
export async function nextReveal(): Promise<{
  card: RevealableCard | null;
  remaining: number;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { card: null, remaining: 0 };

  const [pending, total] = await Promise.all([
    supabase
      .from("card_grants")
      .select("id, card_id, source, granted_at")
      .eq("profile_id", user.id)
      .is("revealed_at", null)
      .order("granted_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    pendingRevealCount(),
  ]);

  if (pending.error) {
    console.error("[cartes] révélation illisible", {
      code: pending.error.code,
    });
    return { card: null, remaining: 0 };
  }

  const card = pending.data ? await loadCard(supabase, pending.data) : null;

  return {
    card,
    // What is left once this one has been opened.
    remaining: Math.max(total - 1, 0),
  };
}

export type CardDetail = RevealableCard & {
  /** How many copies of this card the participant holds. */
  copies: number;
};

/**
 * One card of the participant's album.
 *
 * **Only a card they hold.** The album deliberately shows an unheld card as
 * an outline with no title and no picture, and a page reachable by typing an
 * identifier would undo that in one step. The public gallery of story 5.8 is
 * where the whole catalogue gets shown — on purpose, and to everybody.
 */
export async function getOwnedCard(cardId: string): Promise<CardDetail | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return null;

  const { data } = await supabase
    .from("card_grants")
    .select("id, card_id, source, granted_at")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .eq("card_id", cardId)
    .order("granted_at", { ascending: true });

  const grants = data ?? [];
  if (grants.length === 0) return null;

  const card = await loadCard(supabase, grants[0]!);
  if (!card) return null;

  return {
    ...card,
    // Earned on any copy: a card obtained by playing and then found again in
    // a pack is still an earned card.
    earned: grants.some((grant) => EARNING_SOURCES.has(grant.source)),
    copies: grants.length,
  };
}
