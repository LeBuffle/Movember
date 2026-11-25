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
  /**
   * Duels sent and received (story 12.4 AC 7).
   *
   * **The only reason this is on the support screen** is that a complaint
   * about duels is a complaint about somebody naming somebody else. Answering
   * "qui m'a envoyé ça, et combien de fois" without a screen would mean asking
   * a developer, which is the same as not being able to answer at all.
   */
  duels: {
    sent: number;
    received: number;
    /** Whether they have switched reception off. */
    optedOut: boolean;
    /** Credits still in the wallet. */
    balance: number;
    recent: Array<{
      id: string;
      direction: "sent" | "received";
      otherName: string;
      typeName: string;
      status: string;
      sentAt: string;
      free: boolean;
    }>;
  };
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

  const [registration, connection, challenges, cards, team, shipping, duels] =
    await Promise.all([
      registrationDetail(id, edition),
      connectionDetail(id),
      challengeHistory(id, edition),
      cardHistory(id, edition),
      teamOf(id, edition),
      shippingOf(id, edition),
      duelHistory(id, edition),
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
    duels,
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

/**
 * The duels one participant has been part of (story 12.4 AC 7).
 *
 * Read with the organisation's own session: the admin policy on `duels` is
 * what allows this, and there is no filter here that a mistake could drop.
 *
 * Bounded to the last twenty. What a support request needs is "combien, et de
 * qui", not a month of history — and the counts above answer the first half.
 */
async function duelHistory(id: string, edition: string | null) {
  const empty = {
    sent: 0,
    received: 0,
    optedOut: false,
    balance: 0,
    recent: [],
  };
  if (!edition) return empty;

  const supabase = await createClient();

  const [sent, received, profile, balance] = await Promise.all([
    supabase
      .from("duels")
      .select("id, receiver_id, status, sent_at, free, duel_types (name)", {
        count: "exact",
      })
      .eq("sender_id", id)
      .eq("edition_id", edition)
      .order("sent_at", { ascending: false })
      .limit(20),
    supabase
      .from("duels")
      .select("id, sender_id, status, sent_at, free, duel_types (name)", {
        count: "exact",
      })
      .eq("receiver_id", id)
      .eq("edition_id", edition)
      .order("sent_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("duels_opt_out")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("duel_credit_balance", {
      p_profile: id,
      p_edition: edition,
    }),
  ]);

  type Row = {
    id: string;
    sender_id?: string;
    receiver_id?: string;
    status: string;
    sent_at: string;
    free: boolean;
    duel_types: { name: string } | null;
  };

  const sentRows = (sent.data ?? []) as unknown as Row[];
  const receivedRows = (received.data ?? []) as unknown as Row[];

  const others = [
    ...sentRows.map((row) => row.receiver_id),
    ...receivedRows.map((row) => row.sender_id),
  ].filter((value): value is string => Boolean(value));

  const names = new Map<string, string>();

  if (others.length > 0) {
    const { data } = await supabase
      .from("public_profiles")
      .select("id, display_name")
      .in("id", [...new Set(others)]);

    for (const row of data ?? []) names.set(row.id, row.display_name);
  }

  const recent = [
    ...sentRows.map((row) => ({
      id: row.id,
      direction: "sent" as const,
      otherName: names.get(row.receiver_id ?? "") ?? "Participant",
      typeName: row.duel_types?.name ?? "Défi",
      status: row.status,
      sentAt: row.sent_at,
      free: row.free,
    })),
    ...receivedRows.map((row) => ({
      id: row.id,
      direction: "received" as const,
      otherName: names.get(row.sender_id ?? "") ?? "Participant",
      typeName: row.duel_types?.name ?? "Défi",
      status: row.status,
      sentAt: row.sent_at,
      free: row.free,
    })),
  ]
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt))
    .slice(0, 20);

  return {
    sent: sent.count ?? sentRows.length,
    received: received.count ?? receivedRows.length,
    optedOut: profile.data?.duels_opt_out === true,
    balance: Number(balance.data ?? 0),
    recent,
  };
}
