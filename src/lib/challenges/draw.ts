import type { SportFamily } from "@/lib/challenges/sports";

/**
 * Choosing one participant's challenge for one day.
 *
 * **Deterministic, and that is the important property.** The same participant
 * on the same day always draws the same challenge, because the choice is made
 * from a seed built out of those two things rather than from a random number.
 *
 * Which means re-running the daily task is harmless *before* the database
 * even gets involved: the second run reaches the same conclusion as the
 * first. The unique index is still there and still decides — but a task whose
 * correctness rests only on a constraint is a task nobody can reason about,
 * and this one can be replayed in a test and give the same answer.
 *
 * Pure, like the evaluators of story 4.3: no clock, no database. What "today"
 * is and who is playing are the caller's business.
 */

export type DrawCandidate = {
  id: string;
  sportFamily: SportFamily;
};

export type DrawInput = {
  /** Active challenges of the edition. */
  candidates: DrawCandidate[];
  /** Challenge identifiers this participant has already been given. */
  alreadyReceived: readonly string[];
  /**
   * Sports the participant is known to practise.
   *
   * Empty means "we do not know" — which is not the same as "none", and is
   * the normal state until the activity history of epic 3 exists.
   */
  practisedSports: readonly SportFamily[];
  /** Anything stable that identifies this participant and this day. */
  seed: string;
};

export type DrawResult =
  | { drawn: true; challengeId: string; catchUp: false }
  /** Every challenge has been seen: the no-repeat rule is relaxed. */
  | { drawn: true; challengeId: string; catchUp: true }
  | { drawn: false; reason: "empty-catalogue" };

/**
 * FNV-1a, 32 bits.
 *
 * A hash, not a random number generator, and the difference is the point:
 * the same string always produces the same figure, on any machine and in any
 * order. Twelve lines rather than a dependency — this is the whole of what is
 * needed, and a library would be a supply chain for a hash.
 */
export function seedNumber(seed: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    // The FNV prime, applied without `*` so the result stays a 32-bit
    // integer rather than drifting into floating point.
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return hash >>> 0;
}

/** One of them, chosen by the seed. Sorted first, so order in cannot matter. */
function pick(candidates: DrawCandidate[], seed: string): DrawCandidate {
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));

  return sorted[seedNumber(seed) % sorted.length]!;
}

/**
 * Filters to sports the participant is known to do, keeping the all-purpose
 * ones.
 *
 * Not a recommendation engine — a filter, as story 4.4 asks. The point is
 * modest and worth having: not handing a swimming challenge to somebody who
 * has never swum. `any` challenges stay in every case, because they are what
 * makes a fallback possible.
 */
function preferred(
  candidates: DrawCandidate[],
  practisedSports: readonly SportFamily[],
): DrawCandidate[] {
  if (practisedSports.length === 0) {
    // History says nothing. Rather than guessing, prefer the challenges that
    // suit anybody (architecture D13).
    return candidates.filter((candidate) => candidate.sportFamily === "any");
  }

  return candidates.filter(
    (candidate) =>
      candidate.sportFamily === "any" ||
      practisedSports.includes(candidate.sportFamily),
  );
}

export function drawChallenge(input: DrawInput): DrawResult {
  const { candidates, alreadyReceived, practisedSports, seed } = input;

  if (candidates.length === 0)
    return { drawn: false, reason: "empty-catalogue" };

  const seen = new Set(alreadyReceived);
  const unseen = candidates.filter((candidate) => !seen.has(candidate.id));

  if (unseen.length > 0) {
    const suited = preferred(unseen, practisedSports);

    // Falling back to the whole unseen set rather than repeating: a challenge
    // in a sport they may not do is still better than one they have already
    // completed.
    const pool = suited.length > 0 ? suited : unseen;

    return { drawn: true, challengeId: pick(pool, seed).id, catchUp: false };
  }

  /* Everything has been seen. Repeating is the least bad answer — an empty
     screen on a November morning is the worst — and it is named `catchUp` so
     that nobody later mistakes it for a normal draw. */
  const suited = preferred(candidates, practisedSports);
  const pool = suited.length > 0 ? suited : candidates;

  return { drawn: true, challengeId: pick(pool, seed).id, catchUp: true };
}

/** `<profil>:<jour>` — stable, and unique to the pair. */
export function drawSeed(profileId: string, isoDate: string): string {
  return `${profileId}:${isoDate}`;
}
