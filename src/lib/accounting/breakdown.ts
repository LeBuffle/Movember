import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the money came from, tier by tier (story 9.2).
 *
 * **The consistency check is the point of this file.** Two figures that ought
 * to be equal and are not, on an accounting screen, ruin trust in the whole
 * screen — including in the figures that are right. So the breakdown carries
 * its own reconciliation, and the screen says so out loud.
 *
 * **The committed amount is not the collected amount.** The association
 * commits to a sum per tier; the rest covers the medal and the cards. Both
 * have to appear, otherwise "reversé" will be read as "collecté" — which is
 * exactly the confusion `CLAUDE.md` §6 exists to prevent.
 */

export type TierBreakdown = {
  slug: string;
  name: string;
  /** Paid registrations, refunds excluded. */
  count: number;
  grossCents: number;
  /** What the association commits to hand to the foundation. */
  donationCents: number;
  refundCount: number;
  refundedCents: number;
};

export type Breakdown = {
  tiers: TierBreakdown[];
  /**
   * Packs bought in the shop (epic 10), counted apart from the tiers.
   *
   * They carry no tier and never will — a pack is not a registration level.
   * Without their own line they would land in `unattributed`, which is the
   * line that means "something is wrong", and every pack sold would look like
   * an anomaly to chase.
   */
  packs: { count: number; grossCents: number; donationCents: number };
  /**
   * Duel credits bought by participants (epic 12), counted apart again.
   *
   * Same trap as the packs, same answer: without their own line every lot
   * sold would land in `unattributed` — the line that means *something is
   * wrong* — and every sale would look like an anomaly to chase.
   *
   * `bought` and `spent` are credits, not money. They are here because the
   * difference between them is what decision P8 hands to the foundation on
   * 30 November, and without them that share is worked out by hand.
   */
  credits: {
    count: number;
    grossCents: number;
    donationCents: number;
    bought: number;
    spent: number;
  };
  /** Payments whose tier could not be established. Normally none. */
  unattributed: { count: number; grossCents: number };
  totals: { grossCents: number; refundedCents: number; donationCents: number };
  /**
   * Whether the tier lines add up to the general total.
   *
   * False is not a rounding error — it means a payment carries no tier, and
   * the screen has to say so rather than show two totals that disagree.
   */
  reconciles: boolean;
};

const EMPTY: Breakdown = {
  tiers: [],
  packs: { count: 0, grossCents: 0, donationCents: 0 },
  credits: { count: 0, grossCents: 0, donationCents: 0, bought: 0, spent: 0 },
  unattributed: { count: 0, grossCents: 0 },
  totals: { grossCents: 0, refundedCents: 0, donationCents: 0 },
  reconciles: true,
};

type Row = {
  kind: string;
  gross_cents: number;
  donation_cents: number;
  registrations: {
    registration_tiers: { slug: string; name: string } | null;
  } | null;
};

export async function getBreakdown(): Promise<Breakdown> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return EMPTY;

  const { data, error } = await supabase
    .from("payments")
    .select(
      "kind, gross_cents, donation_cents, registrations (registration_tiers (slug, name))",
    )
    .eq("edition_id", edition.id);

  if (error) {
    console.error("[collecte] ventilation illisible", { code: error.code });
    return EMPTY;
  }

  const rows = (data ?? []) as unknown as Row[];

  const byTier = new Map<string, TierBreakdown>();
  const packs = { count: 0, grossCents: 0, donationCents: 0 };
  const credits = {
    count: 0,
    grossCents: 0,
    donationCents: 0,
    bought: 0,
    spent: 0,
  };
  const unattributed = { count: 0, grossCents: 0 };
  const totals = { grossCents: 0, refundedCents: 0, donationCents: 0 };

  for (const row of rows) {
    // A refund row carries a POSITIVE amount and is subtracted (story 2.6).
    // Getting this backwards once already announced money the association no
    // longer had, on the public page.
    const isRefund = row.kind === "refund";

    const tier = row.registrations?.registration_tiers ?? null;

    if (isRefund) {
      totals.refundedCents += row.gross_cents;
    } else {
      totals.grossCents += row.gross_cents;
      totals.donationCents += row.donation_cents;
    }

    // A pack has its own line (epic 10). It carries no tier and never will,
    // so counting it as unattributed would make every sale look like a
    // problem.
    if (row.kind === "pack") {
      packs.count += 1;
      packs.grossCents += row.gross_cents;
      packs.donationCents += row.donation_cents;
      continue;
    }

    // Duel credits, for the same reason (story 12.8).
    if (row.kind === "credits") {
      credits.count += 1;
      credits.grossCents += row.gross_cents;
      credits.donationCents += row.donation_cents;
      continue;
    }

    if (!tier) {
      // Only income lines are reported as unattributed: a refund with no
      // tier is a consequence of the payment it undoes, not a second
      // anomaly to chase.
      if (!isRefund) {
        unattributed.count += 1;
        unattributed.grossCents += row.gross_cents;
      }
      continue;
    }

    const entry = byTier.get(tier.slug) ?? {
      slug: tier.slug,
      name: tier.name,
      count: 0,
      grossCents: 0,
      donationCents: 0,
      refundCount: 0,
      refundedCents: 0,
    };

    if (isRefund) {
      entry.refundCount += 1;
      entry.refundedCents += row.gross_cents;
    } else {
      entry.count += 1;
      entry.grossCents += row.gross_cents;
      entry.donationCents += row.donation_cents;
    }

    byTier.set(tier.slug, entry);
  }

  const tiers = [...byTier.values()].sort(
    (left, right) => right.grossCents - left.grossCents,
  );

  const summedGross =
    tiers.reduce((sum, tier) => sum + tier.grossCents, 0) +
    packs.grossCents +
    credits.grossCents +
    unattributed.grossCents;

  const usage = await creditUsage(supabase, edition.id);
  credits.bought = usage.bought;
  credits.spent = usage.spent;

  return {
    tiers,
    packs,
    credits,
    unattributed,
    totals,
    reconciles: summedGross === totals.grossCents,
  };
}

/**
 * How many credits were bought, and how many actually sent a duel.
 *
 * **Not an accounting figure, and useful all the same.** It is what will say,
 * on 30 November, how many bought credits were never used — which is the
 * share of this revenue that decision P8 hands to the foundation without a
 * duel ever having been sent. Without it, that share is worked out by hand
 * from the ledger.
 *
 * Read from the ledger rather than counted from the duels: the ledger is the
 * only definition of a credit in this project, and two ways of counting the
 * same thing eventually disagree.
 */
async function creditUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  editionId: string,
): Promise<{ bought: number; spent: number }> {
  const { data, error } = await supabase
    .from("duel_credit_entries")
    .select("delta")
    .eq("edition_id", editionId);

  if (error) {
    console.error("[collecte] mouvements de crédits illisibles", {
      code: error.code,
    });
    return { bought: 0, spent: 0 };
  }

  let bought = 0;
  let spent = 0;

  for (const row of data ?? []) {
    if (row.delta > 0) bought += row.delta;
    else spent += -row.delta;
  }

  return { bought, spent };
}
