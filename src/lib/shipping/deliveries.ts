import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import type { DeliveryRow } from "@/lib/shipping/export";
import { createClient } from "@/lib/supabase/server";

/**
 * Who is owed a parcel, and where it goes.
 *
 * Read through the administrator's own session, so row level security is what
 * grants it — the policy on `shipping_addresses` lets an admin read, and
 * nobody else read anyone but themselves. Reaching for the service key here
 * would put the most personal data in the project behind a check this file
 * happens to make.
 */

export type Deliveries = {
  rows: DeliveryRow[];
  /** Participants owed a parcel who have not given an address yet. */
  missing: Array<{ tierName: string; displayName: string }>;
};

export async function getDeliveries(): Promise<Deliveries> {
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return { rows: [], missing: [] };

  const { data: tiers } = await supabase
    .from("registration_tiers")
    .select("id, name, position")
    .eq("edition_id", edition.id)
    .eq("requires_shipping", true);

  if (!tiers || tiers.length === 0) return { rows: [], missing: [] };

  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

  // Active only. Someone who never paid, or who was refunded, is owed
  // nothing — and their address has no business on a picking list.
  const { data: registrations } = await supabase
    .from("registrations")
    .select("profile_id, tier_id")
    .eq("edition_id", edition.id)
    .eq("status", "active")
    .in(
      "tier_id",
      tiers.map((tier) => tier.id),
    );

  if (!registrations || registrations.length === 0) {
    return { rows: [], missing: [] };
  }

  const profileIds = registrations.map((row) => row.profile_id);

  const [{ data: addresses }, { data: profiles }] = await Promise.all([
    supabase
      .from("shipping_addresses")
      .select(
        "profile_id, recipient_name, line1, line2, postal_code, city, country",
      )
      .eq("edition_id", edition.id)
      .in("profile_id", profileIds),
    supabase.from("profiles").select("id, display_name").in("id", profileIds),
  ]);

  const addressBy = new Map(
    (addresses ?? []).map((address) => [address.profile_id, address]),
  );
  const nameBy = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  const rows: DeliveryRow[] = [];
  const missing: Deliveries["missing"] = [];

  for (const registration of registrations) {
    const tierName = tierById.get(registration.tier_id)?.name ?? "—";
    const displayName = nameBy.get(registration.profile_id) ?? "—";
    const address = addressBy.get(registration.profile_id);

    if (!address) {
      // Listed, not hidden. A parcel nobody can send is the thing the
      // organiser most needs to see before the labels are printed.
      missing.push({ tierName, displayName });
      continue;
    }

    rows.push({
      tierName,
      displayName,
      recipientName: address.recipient_name,
      line1: address.line1,
      line2: address.line2 ?? "",
      postalCode: address.postal_code,
      city: address.city,
      country: address.country,
    });
  }

  // By tier, then by city: whoever packs the parcels works one tier at a
  // time, and a postal service is happier with a sorted stack.
  const order = (name: string) =>
    tiers.find((tier) => tier.name === name)?.position ?? 99;

  rows.sort(
    (a, b) =>
      order(a.tierName) - order(b.tierName) ||
      a.postalCode.localeCompare(b.postalCode, "fr"),
  );
  missing.sort((a, b) => order(a.tierName) - order(b.tierName));

  return { rows, missing };
}
