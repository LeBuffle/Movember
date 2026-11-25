/**
 * Which card a completed challenge produces.
 *
 * A pure function, like the challenge evaluators (story 4.3): what is
 * available goes in, a card comes out. Which is what makes the probabilities
 * testable — and the probabilities are the one thing here nobody can check by
 * looking at the screen.
 *
 * **The challenge's difficulty does not influence the rarity** (PRD D9).
 * That is counter-intuitive and deliberate: tying the two would make easy
 * challenges a source of worthless cards, and the least sporty participant
 * would collect nothing but grey.
 */

export type Rarity = "commune" | "rare" | "epique" | "legendaire";

/** Highest last. Used when a rarity has nothing left to give. */
export const RARITY_ORDER: Rarity[] = [
  "commune",
  "rare",
  "epique",
  "legendaire",
];

export type DrawableCard = {
  id: string;
  rarity: Rarity;
};

export type RarityWeight = {
  slug: Rarity;
  weight: number;
};

export type DrawInput = {
  /** Every published card of the edition. */
  cards: readonly DrawableCard[];
  weights: readonly RarityWeight[];
  /** Card identifiers the participant already holds. */
  owned: ReadonlySet<string>;
  /** In [0, 1). Passed in so the draw stays a pure function. */
  roll: number;
  /** A second value, for choosing within a rarity. */
  pick: number;
};

/**
 * @returns the card drawn, or `null` when the catalogue has nothing
 *   publishable at all. Null is a real answer here: in September the
 *   catalogue is empty, and a challenge completed then must not fail because
 *   of it.
 */
export function drawCard(input: DrawInput): DrawableCard | null {
  const available = input.cards;
  if (available.length === 0) return null;

  const rarity = chooseRarity(input.weights, available, input.roll);
  if (!rarity) return null;

  const pool = available.filter((card) => card.rarity === rarity);

  return chooseWithin(pool, input.owned, input.pick);
}

/**
 * The rarity, by weight — but only among rarities that have a card.
 *
 * Filtering **before** rolling rather than rolling and falling back keeps the
 * announced odds true. A catalogue with no epic card would otherwise turn
 * every epic roll into a common one, quietly making commons more likely than
 * the weights say.
 */
function chooseRarity(
  weights: readonly RarityWeight[],
  cards: readonly DrawableCard[],
  roll: number,
): Rarity | null {
  const stocked = weights.filter(
    (entry) =>
      entry.weight > 0 && cards.some((card) => card.rarity === entry.slug),
  );

  if (stocked.length === 0) return null;

  const total = stocked.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;

  // `roll` is clamped rather than trusted: a caller passing exactly 1 would
  // otherwise fall past the last slice and return nothing.
  let remaining = Math.min(Math.max(roll, 0), 0.999999) * total;

  for (const entry of stocked) {
    remaining -= entry.weight;
    if (remaining < 0) return entry.slug;
  }

  return stocked.at(-1)!.slug;
}

/**
 * A card within the rarity, preferring one the participant is missing.
 *
 * **Preferring, not imposing.** Getting a duplicate is part of collecting;
 * getting five in a row kills it. Once every card of the rarity is owned, the
 * draw goes back to the whole pool rather than refusing — a completed
 * collection must not stop producing cards.
 */
function chooseWithin(
  pool: readonly DrawableCard[],
  owned: ReadonlySet<string>,
  pick: number,
): DrawableCard | null {
  if (pool.length === 0) return null;

  const missing = pool.filter((card) => !owned.has(card.id));
  const candidates = missing.length > 0 ? missing : pool;

  const index = Math.min(
    Math.floor(Math.min(Math.max(pick, 0), 0.999999) * candidates.length),
    candidates.length - 1,
  );

  return candidates[index]!;
}

/**
 * A pack of five, with one guaranteed rarity (story 5.7).
 *
 * The guarantee is a *floor*, not a ceiling: the other four are drawn
 * normally, so a pack can hold two legendaries. Forcing the rest to be
 * common would make the guarantee feel like a consolation prize.
 *
 * `guaranteed` is optional because a bought pack may carry no guarantee at
 * all (story 10.1) — that is a legitimate pack, and a cheaper one. Omitting
 * it makes the whole pack ordinary draws, which is exactly what happens
 * anyway when the catalogue holds none of the guaranteed rarity.
 */
export function drawPack(
  input: Omit<DrawInput, "roll" | "pick"> & {
    rolls: readonly number[];
    guaranteed?: Rarity | null;
    size?: number;
  },
): DrawableCard[] {
  const size = input.size ?? 5;
  const drawn: DrawableCard[] = [];
  const owned = new Set(input.owned);

  const guaranteedPool = input.guaranteed
    ? input.cards.filter((card) => card.rarity === input.guaranteed)
    : [];

  // The guaranteed one first, so the rest of the pack can avoid duplicating
  // it. If the catalogue has none of that rarity yet, the pack is simply five
  // ordinary draws — better than refusing to hand anything over.
  if (guaranteedPool.length > 0) {
    const card = chooseWithin(guaranteedPool, owned, input.rolls[0] ?? 0);

    if (card) {
      drawn.push(card);
      owned.add(card.id);
    }
  }

  for (let index = drawn.length; index < size; index += 1) {
    const card = drawCard({
      cards: input.cards,
      weights: input.weights,
      owned,
      roll: input.rolls[index * 2] ?? 0,
      pick: input.rolls[index * 2 + 1] ?? 0,
    });

    if (!card) break;

    drawn.push(card);
    owned.add(card.id);
  }

  return drawn;
}
