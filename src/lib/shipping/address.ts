import "server-only";

import { z } from "zod";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The postal address a counterpart gets sent to.
 *
 * **Asked for after the payment, never during** (AC 2). Every field added to
 * a payment funnel pushes people out of it, and a postal address is five.
 * It is not needed until the end of the game, two months later — asking then
 * costs nothing, asking before costs registrations.
 *
 * **And never a condition of playing** (AC 4). Someone without an address
 * plays normally and gets reminded. The medal is a counterpart, not an
 * entry ticket; holding the game hostage over a postcode would be out of all
 * proportion.
 *
 * Read and written through the participant's own session, so row level
 * security is what keeps one address out of another person's reach. This is
 * the most personal data in the project — a name and a street, not a
 * pseudonym and a running time.
 */

/* Free text, bounded but not validated for shape. The market is France and
   the EU: a strict format check rejects valid addresses — a lieu-dit with no
   street number, a "BP", a foreign postcode — for no benefit at this scale.
   The bounds mirror the database's, so a refusal is a sentence in the form
   rather than a Postgres error nobody can read. */
const trimmed = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} : ce champ est obligatoire.` })
    .trim()
    .min(min, `${label} : ce champ est obligatoire.`)
    .max(max, `${label} : ${max} caractères au maximum.`);

export const shippingAddressSchema = z.object({
  // Not taken from the profile: a parcel may go to a workplace or a parent's
  // house, and a pseudonym is no use to a postman.
  recipient_name: trimmed("Nom du destinataire", 2, 120),
  line1: trimmed("Adresse", 2, 160),
  line2: z
    .string()
    .trim()
    .max(160, "Complément : 160 caractères au maximum.")
    .default(""),
  postal_code: trimmed("Code postal", 2, 16),
  city: trimmed("Ville", 1, 100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{2}$/,
      "Pays : indiquez un code à deux lettres, par exemple FR.",
    )
    .default("FR"),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export type StoredAddress = ShippingAddress & { id: string };

export type ShippingContext = {
  /** Whether this participant has anything to receive at all. */
  required: boolean;
  /** Named so the screen can say *why* an address is being asked for. */
  tierName: string | null;
  address: StoredAddress | null;
};

const EMPTY: ShippingContext = {
  required: false,
  tierName: null,
  address: null,
};

/**
 * What the participant's screen needs to know.
 *
 * Returns "not required" for anyone whose registration is not active, and for
 * any tier with nothing to post. Both are the same answer from the screen's
 * point of view: do not ask.
 */
export async function getShippingContext(): Promise<ShippingContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY;

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return EMPTY;

  const { data: registration } = await supabase
    .from("registrations")
    .select("status, tier_id")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  if (registration?.status !== "active") return EMPTY;

  const { data: tier } = await supabase
    .from("registration_tiers")
    .select("name, requires_shipping")
    .eq("id", registration.tier_id)
    .maybeSingle();

  if (!tier?.requires_shipping) return EMPTY;

  const { data: address } = await supabase
    .from("shipping_addresses")
    .select("id, recipient_name, line1, line2, postal_code, city, country")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  return {
    required: true,
    tierName: tier.name,
    address: address
      ? {
          id: address.id,
          recipient_name: address.recipient_name,
          line1: address.line1,
          line2: address.line2 ?? "",
          postal_code: address.postal_code,
          city: address.city,
          country: address.country,
        }
      : null,
  };
}

/** One line, for a screen or a label. */
export function formatAddress(address: ShippingAddress): string {
  return [
    address.recipient_name,
    address.line1,
    address.line2,
    `${address.postal_code} ${address.city}`,
    address.country === "FR" ? "" : address.country,
  ]
    .filter((part) => part.trim() !== "")
    .join(", ");
}
