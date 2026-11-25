import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";
import type { DuelStatus } from "@/types/database";

/**
 * Reading duels, for the two screens that show them.
 *
 * Read through the participant's own session: the row level security policy
 * on `duels` says a participant sees the duels they sent and the duels they
 * received, and nothing else. A duel is addressed to somebody — it is not
 * public the way a ranking is.
 *
 * Pseudonyms come from `public_profiles`, never from `profiles`: reading the
 * table for a name would hand over the e-mail address in the same query.
 */

export type DuelView = {
  id: string;
  status: DuelStatus;
  /** The other participant, from the reader's point of view. */
  otherName: string;
  otherId: string;
  typeName: string;
  typeTagline: string;
  sentAt: string;
  expiresAt: string;
  metAt: string | null;
  free: boolean;
  expiryMessageKey: string | null;
  /** Set when this duel is a riposte to another one. */
  parentDuelId: string | null;
  /** Whether a free riposte is still available on it (story 12.6). */
  ripostable: boolean;
};

type Row = {
  id: string;
  status: DuelStatus;
  sender_id: string;
  receiver_id: string;
  sent_at: string;
  expires_at: string;
  met_at: string | null;
  free: boolean;
  expiry_message_key: string | null;
  parent_duel_id: string | null;
  duel_types: { name: string; tagline: string } | null;
};

const SELECTION =
  "id, status, sender_id, receiver_id, sent_at, expires_at, met_at, free, expiry_message_key, parent_duel_id, duel_types (name, tagline)";

export type DuelBoard = {
  /** Duels aimed at the reader, soonest to expire first. */
  received: DuelView[];
  /** Duels the reader sent, most recent first. */
  sent: DuelView[];
  balance: number;
  /** True when the reader has switched duels off. */
  optedOut: boolean;
};

const EMPTY: DuelBoard = {
  received: [],
  sent: [],
  balance: 0,
  optedOut: false,
};

export async function getDuelBoard(limit = 30): Promise<DuelBoard> {
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

  const [received, sent, profile, balance, ripostes] = await Promise.all([
    supabase
      .from("duels")
      .select(SELECTION)
      .eq("receiver_id", user.id)
      .eq("edition_id", edition.id)
      // Open first, then by deadline: what is about to expire is what the
      // reader has to act on, and it belongs at the top.
      .order("status", { ascending: true })
      .order("expires_at", { ascending: true })
      .limit(limit),
    supabase
      .from("duels")
      .select(SELECTION)
      .eq("sender_id", user.id)
      .eq("edition_id", edition.id)
      .order("sent_at", { ascending: false })
      .limit(limit),
    supabase
      .from("profiles")
      .select("duels_opt_out")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("duel_credit_balance", {
      p_profile: user.id,
      p_edition: edition.id,
    }),
    // Which of the reader's met duels have already been answered. Read in one
    // query rather than per row: a riposte button that lies is worse than no
    // button, and asking thirty times would cost thirty round trips.
    supabase
      .from("duels")
      .select("parent_duel_id")
      .eq("sender_id", user.id)
      .not("parent_duel_id", "is", null),
  ]);

  const answered = new Set(
    (ripostes.data ?? [])
      .map((row) => row.parent_duel_id)
      .filter((id): id is string => id !== null),
  );

  const receivedRows = (received.data ?? []) as unknown as Row[];
  const sentRows = (sent.data ?? []) as unknown as Row[];

  const names = await displayNames(
    supabase,
    [
      ...receivedRows.map((row) => row.sender_id),
      ...sentRows.map((row) => row.receiver_id),
    ].filter((id) => id !== user.id),
  );

  const toView = (row: Row, otherId: string): DuelView => ({
    id: row.id,
    status: row.status,
    otherId,
    otherName: names.get(otherId) ?? "Participant",
    typeName: row.duel_types?.name ?? "Défi",
    typeTagline: row.duel_types?.tagline ?? "",
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    metAt: row.met_at,
    free: row.free,
    expiryMessageKey: row.expiry_message_key,
    parentDuelId: row.parent_duel_id,
    // A riposte is only ever offered on a duel the reader received and met,
    // and only once.
    ripostable: row.status === "met" && !answered.has(row.id),
  });

  return {
    received: receivedRows.map((row) => toView(row, row.sender_id)),
    sent: sentRows.map((row) => toView(row, row.receiver_id)),
    balance: Number(balance.data ?? 0),
    optedOut: profile.data?.duels_opt_out === true,
  };
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

async function displayNames(
  supabase: SessionClient,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

/**
 * Whether this participant can be challenged at all.
 *
 * Used to decide whether the ranking shows a "Défier" button. **It is not a
 * protection** — the server checks the same things at every send — it is what
 * stops the screen from offering something that will be refused.
 */
export async function isChallengeable(profileId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("public_profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();

  return data !== null;
}
