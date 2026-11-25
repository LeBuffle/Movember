/**
 * What the association has actually collected.
 *
 * The figures the treasurer needs, and the one figure nobody should be shown
 * without a caveat: a total whose fees are not all known yet. A fee column
 * left at zero and presented as a total produces a number that is wrong and
 * believed — worse than a number that is missing and chased.
 *
 * Summed in the application rather than in SQL. At the scale of one edition —
 * a few hundred payments — the round trip costs nothing, and this way the
 * arithmetic is in one testable function instead of in a query nobody reads.
 * Epic 9 replaces it with a proper export; the shape of the answer will not
 * change.
 */

export type PaymentRow = {
  kind: string;
  gross_cents: number;
  fee_cents: number | null;
  donation_cents: number;
  counterpart_cents: number;
};

export type CollectionTotals = {
  /** Registrations and packs — money in. */
  incomeCount: number;
  grossCents: number;
  donationCents: number;
  counterpartCents: number;

  /** Refunds, counted apart: they are money out (story 2.8). */
  refundCount: number;
  refundedCents: number;

  /** Fees, over the lines where Stripe has told us. */
  knownFeeCents: number;
  /** Lines still waiting for their fee. The reason totals carry a caveat. */
  pendingFeeCount: number;
  pendingFeeGrossCents: number;

  /** Collected minus refunds minus known fees. */
  netCents: number;
  /** Fee rate over the lines where it is known, as a percentage. */
  feeRate: number | null;
  /** Average fee per payment, in cents, where known. */
  averageFeeCents: number | null;
  /** Whether every income line has its fee. */
  complete: boolean;
};

const EMPTY: CollectionTotals = {
  incomeCount: 0,
  grossCents: 0,
  donationCents: 0,
  counterpartCents: 0,
  refundCount: 0,
  refundedCents: 0,
  knownFeeCents: 0,
  pendingFeeCount: 0,
  pendingFeeGrossCents: 0,
  netCents: 0,
  feeRate: null,
  averageFeeCents: null,
  complete: true,
};

export function summarisePayments(rows: PaymentRow[]): CollectionTotals {
  const totals: CollectionTotals = { ...EMPTY };

  let knownFeeGross = 0;
  let knownFeeCount = 0;

  for (const row of rows) {
    if (row.kind === "refund") {
      totals.refundCount += 1;
      // Refund rows carry a positive amount and are subtracted here, rather
      // than stored negative. A negative `gross_cents` would sum to something
      // plausible everywhere it was forgotten; this way, forgetting shows.
      totals.refundedCents += row.gross_cents;
      continue;
    }

    totals.incomeCount += 1;
    totals.grossCents += row.gross_cents;
    totals.donationCents += row.donation_cents;
    totals.counterpartCents += row.counterpart_cents;

    if (row.fee_cents === null) {
      totals.pendingFeeCount += 1;
      totals.pendingFeeGrossCents += row.gross_cents;
    } else {
      totals.knownFeeCents += row.fee_cents;
      knownFeeGross += row.gross_cents;
      knownFeeCount += 1;
    }
  }

  totals.netCents =
    totals.grossCents - totals.refundedCents - totals.knownFeeCents;

  totals.complete = totals.pendingFeeCount === 0;

  // Computed over the lines whose fee is known, never over the whole total:
  // dividing a partial fee by a complete gross would understate the rate,
  // which is precisely the direction that flatters us.
  totals.feeRate =
    knownFeeGross > 0 ? (totals.knownFeeCents / knownFeeGross) * 100 : null;

  totals.averageFeeCents =
    knownFeeCount > 0 ? Math.round(totals.knownFeeCents / knownFeeCount) : null;

  return totals;
}

/** French formatting for a rate: "1,73 %". */
export function formatRate(rate: number): string {
  return `${rate.toFixed(2).replace(".", ",")} %`;
}
