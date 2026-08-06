import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * The registration tiers, read from the database.
 *
 * They moved out of this file and into `registration_tiers` in story 2.1,
 * for one reason: a price has to be changeable without a deployment. The
 * medal quote is not firm, and these amounts may still move before
 * registration opens (PRD D1).
 *
 * **There is no fallback list, and that is deliberate.** A hard-coded set of
 * prices used "when the database is unavailable" would show one price while
 * the payment charged another — the single worst failure this page can have.
 * When the tiers cannot be read, the page says so and shows nothing. An
 * absent price list is an inconvenience; a wrong one is a dispute.
 */

export type RegistrationTier = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  /** What the association commits to handing to the Movember Foundation. */
  donatedCents: number;
  tagline: string;
  perks: string[];
  /** Drawn as the recommended tier. */
  featured: boolean;
  /** Whether something physical has to be posted, so an address is needed. */
  requiresShipping: boolean;
};

/**
 * The tiers on sale for the current edition, in display order.
 *
 * Returns an empty list rather than throwing when the database cannot be
 * reached: the home page carries the cause, the rules and the calendar as
 * well as the prices, and losing all of it over a price list would be the
 * wrong trade. The caller decides what to show instead.
 *
 * **Not to be used to price a payment.** Story 2.3 reads the amount again,
 * from the database, at the moment it creates the Stripe session — and there
 * it must fail loudly. What is displayed can degrade; what is charged cannot.
 */
export async function getRegistrationTiers(): Promise<RegistrationTier[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  /* Two queries rather than one embedded join. The join would be one round
     trip instead of two, and would make this function's return type depend
     on hand-written relationship metadata that nothing checks. On a page
     regenerated every few minutes, the second round trip costs nothing. */
  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    console.error("[tiers] édition introuvable", { year: EDITION_YEAR });
    return [];
  }

  const { data, error } = await supabase
    .from("registration_tiers")
    .select(
      "id, slug, name, tagline, price_cents, donated_cents, perks, position, requires_shipping",
    )
    .eq("edition_id", edition.id)
    .eq("available", true)
    .order("position", { ascending: true });

  if (error || !data) {
    console.error("[tiers] lecture impossible", { code: error?.code });
    return [];
  }

  return data.map((row, index) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceCents: row.price_cents,
    donatedCents: row.donated_cents,
    tagline: row.tagline,
    requiresShipping: row.requires_shipping,
    perks: row.perks,
    /* The middle one, by position. Which tier is highlighted is a display
       decision, not something worth a column — it changes with the number of
       tiers, and there are exactly three. */
    featured: data.length === 3 && index === 1,
  }));
}

/**
 * One tier, by slug — the strict counterpart of `getRegistrationTiers`.
 *
 * Returns `null` rather than degrading, and callers must treat that as a
 * refusal. This is the function the payment path uses: an amount that cannot
 * be read is an amount that must not be charged. The list above may show
 * nothing when the database is unreachable; this one may not guess.
 */
export async function getTierBySlug(
  slug: string,
): Promise<RegistrationTier | null> {
  const tiers = await getRegistrationTiers();
  return tiers.find((tier) => tier.slug === slug) ?? null;
}

/**
 * One tier, by identifier — for resuming a payment.
 *
 * Stronger than the slug for that purpose: the tier is read from the
 * registration already recorded, so nothing the browser sends can change
 * which one is charged. Same refusal contract as above.
 */
export async function getTierById(
  id: string,
): Promise<RegistrationTier | null> {
  const tiers = await getRegistrationTiers();
  return tiers.find((tier) => tier.id === id) ?? null;
}

/** French formatting: comma for decimals, and no cents on a round amount. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
