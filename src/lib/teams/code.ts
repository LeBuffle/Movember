/**
 * The join code, and the slug.
 *
 * Pure, because both are written once and then relied on for a month.
 *
 * **The code gets read aloud in a changing room, or photographed off a
 * whiteboard.** That single fact decides the alphabet: no `O` against `0`,
 * no `I` or `L` against `1`. A code somebody spells wrong is a participant
 * who gives up and does not join — and joining is the growth lever of this
 * edition.
 *
 * Excluding the ambiguous characters is better than trying to correct them
 * afterwards. If `O` can never appear in a code, somebody who types one has
 * misread something, and there is no way to know what: the honest answer is
 * "this code does not exist", and the alphabet is what makes that rare.
 */

/** Twenty-three letters and eight digits. No `I`, `L`, `O`, `0` or `1`. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Eight characters, shown in two groups of four.
 *
 * 31⁸ is about 850 billion combinations. Not a password — the code is a
 * convenience — but guessing one at random is hopeless while typing one from
 * a poster is easy.
 */
export const CODE_LENGTH = 8;

/**
 * @param random values in [0, 1). Passed in so the generator stays pure and
 *   its alphabet can be tested without mocking anything.
 */
export function buildJoinCode(random: readonly number[]): string {
  let code = "";

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const draw = Math.min(Math.max(random[index] ?? 0, 0), 0.999999);
    code += ALPHABET[Math.floor(draw * ALPHABET.length)]!;
  }

  return code;
}

export function generateJoinCode(): string {
  return buildJoinCode(
    Array.from({ length: CODE_LENGTH }, () => Math.random()),
  );
}

/** `ABCD-EFGH`. Grouped for reading, never stored that way. */
export function formatJoinCode(code: string): string {
  return code.length === CODE_LENGTH
    ? `${code.slice(0, 4)}-${code.slice(4)}`
    : code;
}

/**
 * What somebody typed, turned into what is stored.
 *
 * Forgiving about case, spaces and the dash from the display form — the
 * things everybody gets wrong and nobody should be punished for. Not
 * forgiving about characters the alphabet excludes, for the reason above.
 *
 * @returns `null` when what is left is not a code, so the caller says "this
 *   code does not exist" rather than searching for a fragment.
 */
export function normaliseJoinCode(raw: string): string | null {
  const cleaned = raw
    .toUpperCase()
    .split("")
    .filter((character) => ALPHABET.includes(character))
    .join("");

  return cleaned.length === CODE_LENGTH ? cleaned : null;
}

/**
 * A team name turned into something that can live in an address.
 *
 * Accents are folded rather than dropped: "Équipe Café" becomes
 * `equipe-cafe`, not `quipe-caf`.
 *
 * @returns `null` when nothing usable is left — a name written entirely in an
 *   alphabet this does not handle. The caller then asks for a different name
 *   instead of storing an empty slug.
 */
export function slugify(name: string): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return slug.length >= 2 ? slug : null;
}
