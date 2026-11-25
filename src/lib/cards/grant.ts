import "server-only";

import {
  drawCard,
  drawPack,
  type DrawableCard,
  type Rarity,
  type RarityWeight,
} from "@/lib/cards/draw";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Handing a card out.
 *
 * Runs with the service key, like every other write the participant does not
 * make themselves. `card_grants` has no write policy for anybody — somebody
 * able to insert here would grant themselves the legendary, and the
 * collection ranking is exactly what that would destroy.
 */

export type Drawable = {
  cards: DrawableCard[];
  weights: RarityWeight[];
};

/**
 * The publishable catalogue and the weights, read once.
 *
 * Read together because a draw needs both, and because reading them
 * separately invites the moment where a rarity has weight and no card.
 */
export async function drawableCatalogue(editionId: string): Promise<Drawable> {
  const admin = createAdminClient();

  const [cards, weights] = await Promise.all([
    admin
      .from("cards")
      .select("id, rarity")
      .eq("edition_id", editionId)
      .not("published_at", "is", null),
    admin.from("card_rarities").select("slug, weight").order("rank"),
  ]);

  if (cards.error || weights.error) {
    console.error("[cartes] catalogue illisible", {
      code: cards.error?.code ?? weights.error?.code,
    });
    return { cards: [], weights: [] };
  }

  return {
    cards: (cards.data ?? []) as DrawableCard[],
    weights: (weights.data ?? []) as RarityWeight[],
  };
}

/** What a participant already holds, for the "prefer a missing one" rule. */
export async function ownedCardIds(profileId: string): Promise<Set<string>> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("card_grants")
    .select("card_id")
    .eq("profile_id", profileId);

  return new Set((data ?? []).map((row) => row.card_id));
}

/**
 * The card a completed challenge should produce.
 *
 * @returns `null` when the catalogue has nothing to give — which is the
 *   normal state until the visuals arrive in September, and must never stop
 *   a challenge from validating.
 */
export async function pickCardForChallenge(
  profileId: string,
  editionId: string,
): Promise<string | null> {
  const [catalogue, owned] = await Promise.all([
    drawableCatalogue(editionId),
    ownedCardIds(profileId),
  ]);

  const card = drawCard({
    cards: catalogue.cards,
    weights: catalogue.weights,
    owned,
    roll: Math.random(),
    pick: Math.random(),
  });

  return card?.id ?? null;
}

export type PackOutcome = { granted: number; alreadyDone: boolean };

/**
 * The two bonus packs of tier 3 (story 5.7).
 *
 * **Their cards carry the source `pack`, so they never count towards the
 * collection ranking** (architecture D8, NFR20). A bought card enriches a
 * collection; it never improves a score. That single column is what lets the
 * ranking be defended out loud.
 *
 * Replayable: an activation replayed by a webhook retry must not hand out
 * twenty cards. The guard is a count of what this participant already
 * received from packs, and it is checked inside the same call that writes.
 */
export async function grantBonusPacks(
  profileId: string,
  editionId: string,
  packs = 2,
  size = 5,
  guaranteed: Rarity = "legendaire",
): Promise<PackOutcome> {
  const admin = createAdminClient();

  const { count } = await admin
    .from("card_grants")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("edition_id", editionId)
    .eq("source", "pack");

  if ((count ?? 0) > 0) return { granted: 0, alreadyDone: true };

  const [catalogue, owned] = await Promise.all([
    drawableCatalogue(editionId),
    ownedCardIds(profileId),
  ]);

  if (catalogue.cards.length === 0) return { granted: 0, alreadyDone: false };

  const rows: Array<{
    profile_id: string;
    edition_id: string;
    card_id: string;
    source: "pack";
  }> = [];

  const held = new Set(owned);

  for (let pack = 0; pack < packs; pack += 1) {
    const drawn = drawPack({
      cards: catalogue.cards,
      weights: catalogue.weights,
      owned: held,
      rolls: Array.from({ length: size * 2 + 2 }, () => Math.random()),
      guaranteed,
      size,
    });

    for (const card of drawn) {
      held.add(card.id);
      rows.push({
        profile_id: profileId,
        edition_id: editionId,
        card_id: card.id,
        source: "pack",
      });
    }
  }

  if (rows.length === 0) return { granted: 0, alreadyDone: false };

  const { error } = await admin.from("card_grants").insert(rows);

  if (error) {
    console.error("[cartes] packs non attribués", { code: error.code });
    return { granted: 0, alreadyDone: false };
  }

  return { granted: rows.length, alreadyDone: false };
}
