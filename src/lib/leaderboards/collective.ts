import { summarisePayments, type PaymentRow } from "@/lib/accounting/totals";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * What everybody has done together (story 7.7).
 *
 * **Sums, and nothing but sums.** Read with the anonymous client, with no
 * session and no cookie: this appears on the public home page, so it must be
 * readable by a visitor and by a search engine, and it must be cacheable.
 * There is no individual figure here to strip out, because none is fetched.
 *
 * **The amount is the most sensitive number on the page.** It is the total
 * actually taken, computed from `payments` — never an estimate, never a
 * target, never the sum of the tiers people chose. Announcing a total that
 * does not match what was banked would be a problem with the participants and
 * with the foundation alike.
 */

export type CollectiveTotals = {
  /** Kilometres, all sports. */
  kilometres: number;
  /** Hours of activity, all sports. */
  hours: number;
  /** Cents actually collected, refunds deducted. */
  collectedCents: number;
  participants: number;
  /** False when the figures could not be read — as opposed to being zero. */
  available: boolean;
};

const EMPTY: CollectiveTotals = {
  kilometres: 0,
  hours: 0,
  collectedCents: 0,
  participants: 0,
  available: false,
};

export async function collectiveTotals(): Promise<CollectiveTotals> {
  const supabase = createAnonClient();
  if (!supabase) return EMPTY;

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return EMPTY;

  const [{ data: entries, error }, { data: payments }] = await Promise.all([
    supabase
      .from("leaderboard_entries")
      .select(
        "run_distance_meters, bike_distance_meters, total_duration_seconds",
      )
      .eq("edition_id", edition.id),
    // Read straight from the payments rather than from the rankings: money
    // has nothing to do with the game, and mixing the two would be the first
    // step towards a leaderboard that knows what people paid.
    supabase
      .from("payments")
      .select("kind, gross_cents, fee_cents, donation_cents, counterpart_cents")
      .eq("edition_id", edition.id),
  ]);

  if (error) {
    console.error("[compteurs] agrégats illisibles", { code: error.code });
    return EMPTY;
  }

  const rows = entries ?? [];

  const metres = rows.reduce(
    (sum, row) =>
      sum +
      Number(row.run_distance_meters ?? 0) +
      Number(row.bike_distance_meters ?? 0),
    0,
  );

  const seconds = rows.reduce(
    (sum, row) => sum + Number(row.total_duration_seconds ?? 0),
    0,
  );

  // Through the same function as the treasurer's screen, deliberately. A
  // refund row carries a POSITIVE amount and is subtracted (story 2.6) — a
  // second implementation here would eventually disagree with that one, and
  // the public page would announce money the association no longer has.
  const money = summarisePayments((payments ?? []) as PaymentRow[]);

  return {
    kilometres: Math.round(metres / 1000),
    hours: Math.round(seconds / 3600),
    collectedCents: money.grossCents - money.refundedCents,
    participants: rows.length,
    available: true,
  };
}
