/**
 * The delivery list, as a file someone can actually use.
 *
 * CSV rather than a screen to copy from: whoever prints the labels will open
 * it in a spreadsheet, and a hundred addresses transcribed by hand is a
 * hundred chances to send a medal to the wrong street.
 */

export type DeliveryRow = {
  tierName: string;
  displayName: string;
  recipientName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
};

const COLUMNS = [
  "Niveau",
  "Pseudonyme",
  "Destinataire",
  "Adresse",
  "Complément",
  "Code postal",
  "Ville",
  "Pays",
] as const;

/**
 * Escapes one field.
 *
 * A comma inside a city name would otherwise split a row in two, and a
 * quotation mark would break the one after it. Also guards the leading
 * characters a spreadsheet treats as a formula: a name starting with `=` or
 * `+` is a name, not something to evaluate — and a file that runs code when
 * opened is a real way to hand over a machine.
 */
export function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(rows: DeliveryRow[]): string {
  const lines = [
    COLUMNS.map(escapeCsvField).join(","),
    ...rows.map((row) =>
      [
        row.tierName,
        row.displayName,
        row.recipientName,
        row.line1,
        row.line2,
        row.postalCode,
        row.city,
        row.country,
      ]
        .map(escapeCsvField)
        .join(","),
    ),
  ];

  /* CRLF and a byte-order mark: Excel on Windows reads a plain UTF-8 file as
     Latin-1 and turns every accent into mojibake. The list is full of French
     names, so this is not a detail. */
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** `livraisons-2026-03-defis.csv` — sorted, dated, unambiguous. */
export function exportFilename(year: number, isoDate: string): string {
  return `livraisons-${year}-${isoDate}.csv`;
}
