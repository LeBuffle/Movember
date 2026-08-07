import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The participants, for the people who answer their questions (stories 8.2,
 * 8.3).
 *
 * **This is the support screen.** Somebody writes "je ne reçois plus mes
 * défis": the answer is one line here — registration active? Strava linked?
 * Everything else is unnecessary investigation.
 *
 * **The e-mail address is visible here and nowhere else.** It is the assumed
 * exception: the organisation needs it to reply, and participants never see
 * it. That is why these functions read `profiles` rather than the public view
 * every other screen uses — and why they are `server-only` and behind the
 * admin guard.
 *
 * Read through the administrator's own session. The policies on `profiles`,
 * `registrations` and the rest already grant admins a read; using the service
 * key would move the decision from the database to this file.
 */

export type ParticipantRow = {
  id: string;
  displayName: string;
  email: string;
  /** Tier slug, or null when nothing has been paid. */
  tier: string | null;
  registrationStatus: string | null;
  /** Whether a sporting account is linked and healthy. */
  connection: "none" | "linked" | "broken";
  /** Set when the organisation has set this account aside (story 8.7). */
  suspendedAt: string | null;
};

export type ParticipantsPage = {
  rows: ParticipantRow[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
};

const PAGE_SIZE = 25;

const EMPTY: ParticipantsPage = {
  rows: [],
  total: 0,
  page: 1,
  pageCount: 1,
  query: "",
};

type ProfileRow = {
  id: string;
  display_name: string;
  email: string;
  suspended_at: string | null;
  suspension_reason: string | null;
};

/**
 * One page of participants, optionally filtered.
 *
 * @param query Matched against the pseudonym **and** the e-mail. Somebody
 *   answering a message has one or the other, never a knowing choice between
 *   them.
 */
export async function listParticipants(
  page = 1,
  query = "",
): Promise<ParticipantsPage> {
  const supabase = await createClient();

  const term = query.trim();
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;

  let request = supabase
    .from("profiles")
    .select("id, display_name, email, suspended_at, suspension_reason", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (term) {
    // Escaped: a comma or a parenthesis in the search box would otherwise be
    // read as PostgREST syntax and turn a search into a different filter.
    const safe = term.replace(/[,()*]/g, " ").trim();
    if (safe) {
      request = request.or(
        `display_name.ilike.%${safe}%,email.ilike.%${safe}%`,
      );
    }
  }

  const { data, error, count } = await request;

  if (error) {
    console.error("[participants] lecture impossible", { code: error.code });
    return { ...EMPTY, query: term };
  }

  const profiles = (data ?? []) as unknown as ProfileRow[];
  const ids = profiles.map((row) => row.id);

  const [registrations, connections] = await Promise.all([
    registrationsFor(ids),
    connectionsFor(ids),
  ]);

  const total = count ?? 0;

  return {
    rows: profiles.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      tier: registrations.get(row.id)?.tier ?? null,
      registrationStatus: registrations.get(row.id)?.status ?? null,
      connection: connections.get(row.id) ?? "none",
      suspendedAt: row.suspended_at,
    })),
    total,
    page: Math.max(1, page),
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    query: term,
  };
}

async function editionId(): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  return data?.id ?? null;
}

async function registrationsFor(
  ids: string[],
): Promise<Map<string, { tier: string | null; status: string }>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const edition = await editionId();
  if (!edition) return new Map();

  const { data } = await supabase
    .from("registrations")
    .select("profile_id, status, registration_tiers(slug)")
    .eq("edition_id", edition)
    .in("profile_id", ids);

  const rows = (data ?? []) as unknown as Array<{
    profile_id: string;
    status: string;
    registration_tiers: { slug: string } | null;
  }>;

  return new Map(
    rows.map((row) => [
      row.profile_id,
      { tier: row.registration_tiers?.slug ?? null, status: row.status },
    ]),
  );
}

async function connectionsFor(
  ids: string[],
): Promise<Map<string, ParticipantRow["connection"]>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();

  const { data } = await supabase
    .from("activity_connections")
    .select("profile_id, status, disconnected_at")
    .in("profile_id", ids);

  const rows = (data ?? []) as unknown as Array<{
    profile_id: string;
    status: "active" | "broken";
    disconnected_at: string | null;
  }>;

  const map = new Map<string, ParticipantRow["connection"]>();

  for (const row of rows) {
    // A disconnected link is not a broken one: the participant chose it, and
    // showing "rompue" would send support chasing a problem nobody has.
    if (row.disconnected_at) continue;
    map.set(row.profile_id, row.status === "broken" ? "broken" : "linked");
  }

  return map;
}

/* -------------------------------------------------------------------------
 * The individual record (story 8.3)
 * ---------------------------------------------------------------------- */

export type ParticipantDetail = {
  profile: ParticipantRow;
  registration: {
    tier: string | null;
    tierName: string | null;
    status: string;
    activatedAt: string | null;
    paidCents: number | null;
  } | null;
  connection: {
    provider: string;
    status: string;
    connectedAt: string;
    lastSyncedAt: string | null;
  } | null;
  challenges: Array<{
    id: string;
    title: string;
    assignedFor: string;
    status: string;
    points: number;
  }>;
  cards: Array<{ title: string; source: string; grantedAt: string }>;
  team: { name: string; role: string } | null;
  shipping: { city: string; country: string } | null;
  suspension: { since: string; reason: string } | null;
};

/**
 * Everything about one participant, in one read.
 *
 * Seven sources on one screen, and that is the point: without it, answering
 * "pourquoi mon défi d'hier n'est pas validé" means opening four screens and
 * cross-referencing them.
 *
 * @returns `null` when no such profile exists, so the screen can answer 404
 *   rather than render an empty shell.
 */
export async function getParticipant(
  id: string,
): Promise<ParticipantDetail | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, email, suspended_at, suspension_reason")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) return null;

  const edition = await editionId();

  const [registration, connection, challenges, cards, team, shipping] =
    await Promise.all([
      registrationDetail(id, edition),
      connectionDetail(id),
      challengeHistory(id, edition),
      cardHistory(id, edition),
      teamOf(id, edition),
      shippingOf(id, edition),
    ]);

  const row = profile as unknown as ProfileRow;

  return {
    profile: {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      tier: registration?.tier ?? null,
      registrationStatus: registration?.status ?? null,
      connection: connection
        ? connection.status === "broken"
          ? "broken"
          : "linked"
        : "none",
      suspendedAt: row.suspended_at,
    },
    suspension: row.suspended_at
      ? { since: row.suspended_at, reason: row.suspension_reason ?? "" }
      : null,
    registration,
    connection,
    challenges,
    cards,
    team,
    shipping,
  };
}

async function registrationDetail(id: string, edition: string | null) {
  if (!edition) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("registrations")
    .select("status, activated_at, registration_tiers(slug, name, price_cents)")
    .eq("profile_id", id)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    status: string;
    activated_at: string | null;
    registration_tiers: {
      slug: string;
      name: string;
      price_cents: number;
    } | null;
  };

  return {
    tier: row.registration_tiers?.slug ?? null,
    tierName: row.registration_tiers?.name ?? null,
    status: row.status,
    activatedAt: row.activated_at,
    paidCents: row.registration_tiers?.price_cents ?? null,
  };
}

async function connectionDetail(id: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("activity_connections")
    .select("provider, status, connected_at, last_synced_at, disconnected_at")
    .eq("profile_id", id)
    .is("disconnected_at", null)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    provider: string;
    status: string;
    connected_at: string;
    last_synced_at: string | null;
  };

  return {
    provider: row.provider,
    status: row.status,
    connectedAt: row.connected_at,
    lastSyncedAt: row.last_synced_at,
  };
}

async function challengeHistory(id: string, edition: string | null) {
  if (!edition) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("challenge_assignments")
    .select("id, assigned_for, status, points_awarded, challenges(title)")
    .eq("profile_id", id)
    .eq("edition_id", edition)
    .order("assigned_for", { ascending: false })
    .limit(30);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    assigned_for: string;
    status: string;
    points_awarded: number | null;
    challenges: { title: string } | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.challenges?.title ?? "Défi",
    assignedFor: row.assigned_for,
    status: row.status,
    points: row.points_awarded ?? 0,
  }));
}

async function cardHistory(id: string, edition: string | null) {
  if (!edition) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("card_grants")
    .select("source, granted_at, cards(title)")
    .eq("profile_id", id)
    .eq("edition_id", edition)
    .order("granted_at", { ascending: false })
    .limit(30);

  const rows = (data ?? []) as unknown as Array<{
    source: string;
    granted_at: string;
    cards: { title: string } | null;
  }>;

  return rows.map((row) => ({
    title: row.cards?.title ?? "Carte",
    source: row.source,
    grantedAt: row.granted_at,
  }));
}

async function teamOf(id: string, edition: string | null) {
  if (!edition) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("team_members")
    .select("role, teams(name)")
    .eq("profile_id", id)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    role: string;
    teams: { name: string } | null;
  };

  return { name: row.teams?.name ?? "Équipe", role: row.role };
}

/**
 * Whether an address exists, and roughly where.
 *
 * **The street is deliberately not returned.** The full address belongs on
 * the deliveries screen, which exists for the person packing the parcels. A
 * support record does not need it, and every screen that carries it is one
 * more place it can be seen over somebody's shoulder.
 */
async function shippingOf(id: string, edition: string | null) {
  if (!edition) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shipping_addresses")
    .select("city, country")
    .eq("profile_id", id)
    .eq("edition_id", edition)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as { city: string; country: string };
  return { city: row.city, country: row.country };
}
