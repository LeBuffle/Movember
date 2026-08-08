import "server-only";

import { escapeCsvField } from "@/lib/shipping/export";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The accounting export (story 9.3).
 *
 * **The exit criterion of the epic is a line-by-line reconciliation with the
 * Stripe statement**, and it is the Stripe identifier that makes it possible.
 * Without it the treasurer compares amounts and dates, which works right up
 * until two identical payments on the same day — and then it produces a
 * conclusion rather than a doubt.
 *
 * Amounts in euros with a comma, because the file is opened in a French
 * spreadsheet and `12.00` is read as twelve hundred by some locales.
 *
 * Escaping and the byte-order mark are shared with the delivery export
 * (story 2.7): one implementation, one set of accents that survive Excel.
 */

const COLUMNS = [
  "Date",
  "Type",
  "Pseudonyme",
  "Niveau",
  "Montant",
  "Frais Stripe",
  "Montant engagé",
  "Identifiant Stripe",
  "Identifiant interne",
] as const;

/** How each kind of line is named in the file the treasurer opens. */
const KINDS: Record<string, string> = {
  registration: "Inscription",
  pack: "Pack",
  refund: "Remboursement",
};

type Row = {
  id: string;
  kind: string;
  created_at: string;
  gross_cents: number;
  fee_cents: number | null;
  donation_cents: number;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  profile_id: string;
  registrations: {
    registration_tiers: { name: string } | null;
  } | null;
};

export type AccountingLine = {
  date: string;
  kind: string;
  displayName: string;
  tierName: string;
  grossCents: number;
  feeCents: number | null;
  donationCents: number;
  stripeId: string;
  id: string;
};

export async function getAccountingLines(): Promise<AccountingLine[]> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return [];

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, kind, created_at, gross_cents, fee_cents, donation_cents, stripe_charge_id, stripe_payment_intent_id, stripe_refund_id, profile_id, registrations (registration_tiers (name))",
    )
    .eq("edition_id", edition.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[comptabilité] export illisible", { code: error.code });
    return [];
  }

  const rows = (data ?? []) as unknown as Row[];
  const names = await displayNames(rows.map((row) => row.profile_id));

  return rows.map((row) => ({
    date: row.created_at,
    // Three words rather than two: a pack is money in like a registration,
    // but the treasurer has to be able to split the two without a formula.
    kind: KINDS[row.kind] ?? "Encaissement",
    displayName: names.get(row.profile_id) ?? "—",
    tierName: row.registrations?.registration_tiers?.name ?? "—",
    grossCents: row.gross_cents,
    feeCents: row.fee_cents,
    donationCents: row.donation_cents,
    // The refund identifier first for a refund: it is the one that appears in
    // the Stripe statement against that movement.
    stripeId:
      row.stripe_refund_id ??
      row.stripe_charge_id ??
      row.stripe_payment_intent_id ??
      "",
    id: row.id,
  }));
}

/**
 * The file itself.
 *
 * @returns headers alone when there is nothing to export — a file with its
 *   columns and no rows, rather than an error. An empty export in September is
 *   the expected answer, not a failure.
 */
export function toAccountingCsv(lines: AccountingLine[]): string {
  const rows = [
    COLUMNS.map(escapeCsvField).join(","),
    ...lines.map((line) =>
      [
        line.date.slice(0, 10),
        line.kind,
        line.displayName,
        line.tierName,
        euros(line.grossCents),
        line.feeCents === null ? "" : euros(line.feeCents),
        euros(line.donationCents),
        line.stripeId,
        line.id,
      ]
        .map(escapeCsvField)
        .join(","),
    ),
  ];

  // CRLF and a byte-order mark, same reason as the delivery export: Excel on
  // Windows reads a plain UTF-8 file as Latin-1 and turns every accent into
  // mojibake.
  return `﻿${rows.join("\r\n")}\r\n`;
}

/** `12,00` — a comma, because the file is opened in a French spreadsheet. */
function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function accountingFilename(year: number, isoDate: string): string {
  return `comptabilite-${year}-${isoDate}.csv`;
}

async function displayNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}
