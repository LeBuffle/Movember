import "server-only";

import type { Rarity } from "@/lib/cards/draw";
import { drawPack } from "@/lib/cards/draw";
import { drawableCatalogue, ownedCardIds } from "@/lib/cards/grant";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The cards a bought pack produces (story 10.4).
 *
 * **They carry `source = 'purchase'`, and that single column is what lets the
 * collection ranking be defended out loud** (architecture D8, PRD FR72). The
 * ranking counts `challenge` and `daily_draw` and nothing else — enforced one
 * level down, in the materialised view of story 7.3, not here. A bought card
 * enriches an album; it never moves a rank.
 *
 * Runs with the service key, like every card handed out: `card_grants` has no
 * write policy for anybody, and somebody able to insert here would grant
 * themselves the legendary.
 *
 * **Replay-safe.** Stripe resends anything that did not answer in a few
 * seconds. The guard is a count of the rows already carrying this purchase —
 * asked in the same call that writes, and asked of the database rather than
 * remembered in the application.
 */

export type PackGrantOutcome = {
  granted: number;
  alreadyDone: boolean;
  /** Cards were expected and none could be drawn. Never silent. */
  emptyCatalogue: boolean;
};

export type PurchaseToOpen = {
  id: string;
  profileId: string;
  editionId: string;
  cardCount: number;
  guaranteedRarity: Rarity | null;
};

export async function grantPurchasedPack(
  purchase: PurchaseToOpen,
): Promise<PackGrantOutcome> {
  const admin = createAdminClient();

  const { count } = await admin
    .from("card_grants")
    .select("id", { count: "exact", head: true })
    .eq("pack_purchase_id", purchase.id);

  if ((count ?? 0) > 0) {
    return { granted: 0, alreadyDone: true, emptyCatalogue: false };
  }

  const [catalogue, owned] = await Promise.all([
    drawableCatalogue(purchase.editionId),
    ownedCardIds(purchase.profileId),
  ]);

  if (catalogue.cards.length === 0) {
    // September, or a catalogue that has lost its publications. The purchase
    // stays `paid` with no cards attached, so this call recovers on its own
    // the next time it runs — and the line below is what a human acts on.
    console.error("[packs] catalogue vide, aucune carte à remettre", {
      purchase: purchase.id,
    });
    return { granted: 0, alreadyDone: false, emptyCatalogue: true };
  }

  const drawn = drawPack({
    cards: catalogue.cards,
    weights: catalogue.weights,
    owned,
    // Two per card, plus one for the guaranteed pick.
    rolls: Array.from({ length: purchase.cardCount * 2 + 2 }, () =>
      Math.random(),
    ),
    guaranteed: purchase.guaranteedRarity,
    size: purchase.cardCount,
  });

  if (drawn.length === 0) {
    return { granted: 0, alreadyDone: false, emptyCatalogue: true };
  }

  const { error } = await admin.from("card_grants").insert(
    drawn.map((card) => ({
      profile_id: purchase.profileId,
      edition_id: purchase.editionId,
      card_id: card.id,
      source: "purchase" as const,
      pack_purchase_id: purchase.id,
      // Left unrevealed on purpose: the cards join the queue of story 5.5 and
      // are discovered one by one, which is the whole point of buying a pack.
      revealed_at: null,
    })),
  );

  if (error) {
    console.error("[packs] cartes non attribuées", {
      purchase: purchase.id,
      code: error.code,
    });
    return { granted: 0, alreadyDone: false, emptyCatalogue: false };
  }

  return { granted: drawn.length, alreadyDone: false, emptyCatalogue: false };
}
