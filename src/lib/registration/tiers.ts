/**
 * The three registration tiers.
 *
 * **Single access point on purpose.** Epic 2 moves these rows into the
 * `registration_tiers` table, because a price has to be changeable without a
 * deployment — the medal quote is not firm, and the amounts below may move
 * before registration opens. Everything reads `getRegistrationTiers()`, so
 * that swap touches this file and nothing else.
 *
 * Amounts are in cents. Money never goes through a floating-point number:
 * 12.10 € is not representable in binary, and the rounding shows up in an
 * association's accounts.
 */

export type RegistrationTier = {
  slug: string;
  name: string;
  priceCents: number;
  /** Part handed to the Movember Foundation by the association. */
  donatedCents: number;
  tagline: string;
  perks: string[];
  /** Drawn as the recommended tier. Exactly one is expected. */
  featured?: boolean;
};

/**
 * Provisional, and knowingly so.
 *
 * `donatedCents` for tiers 2 and 3 depends on the medal and booster costs,
 * which are not settled. What must NOT be written anywhere is "100 %": on the
 * first tier, 12 € paid means about 11,57 € left after the payment
 * processor's fee. Saying "12 € reversés" states the association's
 * commitment and stays true whoever absorbs the fee — which is decision P2,
 * still open.
 */
const TIERS: RegistrationTier[] = [
  {
    slug: "engage",
    name: "Sportif engagé",
    priceCents: 1200,
    donatedCents: 1200,
    tagline: "Pour jouer, tout simplement.",
    perks: [
      "Un défi sportif par jour pendant tout novembre",
      "Une carte offerte chaque jour, par tirage au sort",
      "Accès aux classements et aux équipes",
    ],
  },
  {
    slug: "chevronne",
    name: "Sportif chevronné",
    priceCents: 3000,
    donatedCents: 1800,
    tagline: "Le jeu, et quelque chose à garder.",
    perks: [
      "Tout le niveau Sportif engagé",
      "Une médaille premium envoyée à la fin du défi",
    ],
    featured: true,
  },
  {
    slug: "legendaire",
    name: "Sportif légendaire",
    priceCents: 5000,
    donatedCents: 3500,
    tagline: "Pour les collectionneurs.",
    perks: [
      "Tout le niveau Sportif chevronné",
      "2 packs de 5 cartes moustachues",
      "Une carte légendaire garantie",
    ],
  },
];

/**
 * Async from the start, even though it reads a constant today.
 *
 * The signature is the one epic 2 needs once these rows come from the
 * database. Making it async later would mean touching every caller, at the
 * moment when registration is about to open — the worst possible time.
 */
export async function getRegistrationTiers(): Promise<RegistrationTier[]> {
  return TIERS;
}

/** French formatting: comma for decimals, and no cents on a round amount. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
