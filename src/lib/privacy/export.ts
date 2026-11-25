import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Everything we hold about one participant, on their own request (story 11.1).
 *
 * Article 20 of the GDPR asks for a structured, commonly used,
 * machine-readable format. JSON is that, and it is also the only format that
 * can carry nested data — a month of outings and thirty challenges — without
 * inventing a shape.
 *
 * **Read through the participant's own session, never with the service key.**
 * That is not an implementation detail: row level security is what guarantees
 * this route can only ever return the caller's own data. A service-key version
 * of this file with one wrong identifier would hand somebody else's health
 * data over, and no test would notice.
 *
 * **What is deliberately absent, and why.**
 *
 * - **Tokens.** The Strava access and refresh tokens are held encrypted and
 *   never leave the server. Exporting them would hand over a live key to
 *   somebody's Strava account, in a file that then sits in a Downloads
 *   folder. What is exported is that a link exists, with which provider, and
 *   since when.
 * - **Card data.** We never see it: Stripe does. What we hold is an amount, a
 *   date and an identifier, and all three are in the file.
 * - **The internal integrity assessment** (epic 9). A self-service export
 *   that listed which rule flagged an outing would tell somebody exactly what
 *   to change. It remains available on request to the association, which is
 *   what the privacy policy says.
 */

export type PersonalDataExport = {
  /** So the file can be read in five years without this code. */
  meta: {
    generatedAt: string;
    format: string;
    notice: string;
  };
  profile: unknown;
  registration: unknown;
  payments: unknown;
  packPurchases: unknown;
  consents: unknown;
  activityConnection: unknown;
  activities: unknown;
  challenges: unknown;
  cards: unknown;
  team: unknown;
  notificationPreferences: unknown;
  shippingAddress: unknown;
};

const NOTICE =
  "Export réalisé à votre demande (article 20 du RGPD). Les jetons d’accès à " +
  "votre compte sportif ne figurent pas dans ce fichier : ils sont chiffrés et " +
  "ne quittent jamais nos serveurs. Vos données bancaires ne nous sont jamais " +
  "transmises — seul Stripe les détient.";

export async function buildPersonalDataExport(): Promise<PersonalDataExport | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  /* Every query goes through the participant's session, so each one is
     already restricted to their own rows by row level security. The
     `profile_id` filters below are belt and braces — and they are what makes
     the intent readable to whoever changes a policy later. */
  const [
    profile,
    registration,
    payments,
    packPurchases,
    consents,
    connection,
    activities,
    challenges,
    cards,
    team,
    preferences,
    address,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, email, role, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("registrations")
      .select(
        "status, created_at, activated_at, terms_accepted_at, terms_version, registration_tiers (slug, name, price_cents)",
      )
      .eq("profile_id", user.id),
    supabase
      .from("payments")
      .select(
        "kind, gross_cents, fee_cents, donation_cents, counterpart_cents, created_at, stripe_payment_intent_id",
      )
      .eq("profile_id", user.id),
    supabase
      .from("pack_purchases")
      .select("status, price_cents, card_count, created_at, paid_at")
      .eq("profile_id", user.id),
    supabase
      .from("activity_consents")
      .select("action, version, created_at")
      .eq("profile_id", user.id),
    // Deliberately without the token columns. See the note above.
    supabase
      .from("activity_connections")
      .select(
        "provider, provider_account_id, status, scopes, connected_at, disconnected_at, last_synced_at",
      )
      .eq("profile_id", user.id),
    supabase
      .from("activities")
      .select(
        "provider, name, sport_family, started_at, local_date, distance_meters, duration_seconds, elevation_meters, is_manual",
      )
      .eq("profile_id", user.id)
      .order("started_at", { ascending: true }),
    supabase
      .from("challenge_assignments")
      .select(
        "assigned_for, status, source, points_awarded, completed_at, challenges (title, sport_family, difficulty)",
      )
      .eq("profile_id", user.id)
      .order("assigned_for", { ascending: true }),
    supabase
      .from("card_grants")
      .select("source, granted_at, revealed_at, cards (title, rarity)")
      .eq("profile_id", user.id)
      .order("granted_at", { ascending: true }),
    supabase
      .from("team_members")
      .select("role, joined_at, public_teams (name, kind)")
      .eq("profile_id", user.id),
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase
      .from("shipping_addresses")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  /* A failed query is reported inside the file rather than swallowed.
     Returning a file that silently misses a section is worse than returning
     one that says a section could not be read: the first looks complete. */
  const section = (result: { data: unknown; error: unknown }) =>
    result.error ? { erreur: "section illisible" } : (result.data ?? null);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      format: "defi-movember/export-personnel-v1",
      notice: NOTICE,
    },
    profile: section(profile),
    registration: section(registration),
    payments: section(payments),
    packPurchases: section(packPurchases),
    consents: section(consents),
    activityConnection: section(connection),
    activities: section(activities),
    challenges: section(challenges),
    cards: section(cards),
    team: section(team),
    notificationPreferences: section(preferences),
    shippingAddress: section(address),
  };
}

/** Dated and named so several exports do not overwrite each other. */
export function exportFilename(isoDate: string): string {
  return `defi-movember-mes-donnees-${isoDate}.json`;
}
