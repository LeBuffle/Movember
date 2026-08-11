import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The three duels and the two lots, read from the database (stories 12.1, 12.2).
 *
 * **No hard-coded fallback list**, the same rule as the registration tiers and
 * the card packs, and for the same reason: a price kept in the code "for when
 * the database is unavailable" would show one amount while the payment charged
 * another. When the catalogue cannot be read, nothing is offered and nothing
 * is sold.
 */

export type DuelType = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  evaluator: string;
  config: Record<string, unknown>;
  /** How long the receiver has, in hours. */
  hours: number;
};

export type CreditLot = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  credits: number;
  priceCents: number;
  /** Equal to the price, by database constraint. */
  donatedCents: number;
};

export async function getDuelTypes(): Promise<DuelType[]> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data, error } = await supabase
    .from("duel_types")
    .select("id, slug, name, tagline, evaluator, config, hours")
    .eq("edition_id", edition.id)
    .eq("available", true)
    .order("position", { ascending: true });

  if (error || !data) {
    console.error("[défis-joueurs] catalogue illisible", {
      code: error?.code,
    });
    return [];
  }

  return data.map(toDuelType);
}

/**
 * One duel type, read with the service key.
 *
 * Used by the evaluation, which runs from a webhook with nobody's session and
 * has to read the type of a duel it did not send.
 */
export async function duelTypeById(id: string): Promise<DuelType | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("duel_types")
    .select("id, slug, name, tagline, evaluator, config, hours")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return toDuelType(data);
}

function toDuelType(row: {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  evaluator: string;
  config: Record<string, unknown>;
  hours: number;
}): DuelType {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    evaluator: row.evaluator,
    config: (row.config ?? {}) as Record<string, unknown>,
    hours: row.hours,
  };
}

export async function getCreditLots(): Promise<CreditLot[]> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data, error } = await supabase
    .from("duel_credit_lots")
    .select("id, slug, name, tagline, credits, price_cents, donated_cents")
    .eq("edition_id", edition.id)
    .eq("available", true)
    .order("position", { ascending: true });

  if (error || !data) {
    console.error("[défis-joueurs] lots illisibles", { code: error?.code });
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    credits: row.credits,
    priceCents: row.price_cents,
    donatedCents: row.donated_cents,
  }));
}

/**
 * One lot, by slug — the function the payment path uses.
 *
 * It may not guess: a price that cannot be read is a price that must not be
 * charged. Returns `null`, and the caller treats that as a refusal.
 */
export async function getLotBySlug(slug: string): Promise<CreditLot | null> {
  const lots = await getCreditLots();
  return lots.find((lot) => lot.slug === slug) ?? null;
}

/** What one credit costs, for the shop's "soit 2 € le défi" line. */
export function unitPriceCents(lot: CreditLot): number {
  return Math.round(lot.priceCents / lot.credits);
}
