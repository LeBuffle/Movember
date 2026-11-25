import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The list of payments, for the one screen that needs to act on them.
 *
 * Read through the administrator's session, so row level security answers.
 * Only the refund action reaches for the service key, and only because it
 * writes on nobody's behalf.
 */

export type PaymentEntry = {
  id: string;
  createdAt: string;
  grossCents: number;
  feeCents: number | null;
  displayName: string;
  /** Already refunded — the action must not be offered twice. */
  refunded: boolean;
  refundable: boolean;
};

export async function listPayments(limit = 100): Promise<PaymentEntry[]> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data: rows } = await supabase
    .from("payments")
    .select(
      "id, kind, created_at, gross_cents, fee_cents, profile_id, stripe_charge_id, stripe_payment_intent_id",
    )
    .eq("edition_id", edition.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows || rows.length === 0) return [];

  const profileIds = [
    ...new Set(rows.map((row) => row.profile_id).filter(Boolean)),
  ] as string[];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);

  const nameBy = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  // Which charges already have a refund against them. Computed from the same
  // list rather than queried again: the refund row carries the charge of the
  // payment it undoes.
  const refundedCharges = new Set(
    rows
      .filter((row) => row.kind === "refund")
      .map((row) => row.stripe_charge_id)
      .filter(Boolean),
  );

  return rows
    .filter((row) => row.kind !== "refund")
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      grossCents: row.gross_cents,
      feeCents: row.fee_cents,
      displayName: row.profile_id
        ? (nameBy.get(row.profile_id) ?? "compte supprimé")
        : "compte supprimé",
      refunded: refundedCharges.has(row.stripe_charge_id),
      // Without a Stripe reference there is nothing to ask Stripe to undo.
      refundable: Boolean(row.stripe_payment_intent_id),
    }));
}

export async function getPayment(id: string): Promise<PaymentEntry | null> {
  const payments = await listPayments(500);
  return payments.find((payment) => payment.id === id) ?? null;
}
