import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DuelCreditReason } from "@/types/database";

/**
 * The credit wallet (story 12.1).
 *
 * **A balance is a sum of movements, never a stored counter.** A counter gets
 * corrected by hand the day it is wrong, and from then on nobody knows why it
 * says what it says. A dated, explained movement answers "j'ai payé et mon
 * crédit a disparu" without anybody having to be believed — the same
 * reasoning that made `payments` append-only in story 2.1.
 *
 * The volume makes it free: ten credits bought is one row, ten spent is ten.
 */

export type CreditMovement = {
  id: string;
  delta: number;
  reason: DuelCreditReason;
  note: string | null;
  createdAt: string;
};

export type Wallet = {
  balance: number;
  movements: CreditMovement[];
};

const EMPTY: Wallet = { balance: 0, movements: [] };

/** How a movement is worded on screen, in the reader's own terms. */
export const REASON_LABELS: Record<DuelCreditReason, string> = {
  achat: "Achat de crédits",
  depense: "Défi envoyé",
  retour: "Crédit rendu",
  remboursement: "Remboursement",
  ajustement: "Ajustement par l’organisation",
};

/**
 * The signed-in participant's wallet, read through their own session.
 *
 * Row level security is what says they see their movements and nobody
 * else's — there is no filter here that a mistake could drop.
 */
export async function ownWallet(limit = 30): Promise<Wallet> {
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

  const { data, error } = await supabase
    .from("duel_credit_entries")
    .select("id, delta, reason, note, created_at")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[défis-joueurs] portefeuille illisible", {
      code: error.code,
    });
    return EMPTY;
  }

  const movements = (data ?? []).map((row) => ({
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    note: row.note,
    createdAt: row.created_at,
  }));

  /* The balance is asked of the database rather than summed from the rows
     above: the list is capped at thirty for the screen, and summing a capped
     list would show a balance that is wrong for anybody who has played a lot.
     A figure that is right only for new participants is the worst kind. */
  const { data: balance, error: balanceError } = await supabase.rpc(
    "duel_credit_balance",
    { p_profile: user.id, p_edition: edition.id },
  );

  if (balanceError) {
    console.error("[défis-joueurs] solde illisible", {
      code: balanceError.code,
    });
    return { balance: 0, movements };
  }

  return { balance: Number(balance ?? 0), movements };
}

/**
 * A participant's balance, from a task with no session.
 *
 * Used by the send path, which runs with the service key because it also
 * writes. The figure it returns is advisory: the guarantee is the database
 * trigger, which refuses any movement that would take a balance below zero.
 */
export async function balanceOf(
  profileId: string,
  editionId: string,
): Promise<number> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("duel_credit_balance", {
    p_profile: profileId,
    p_edition: editionId,
  });

  if (error) {
    console.error("[défis-joueurs] solde illisible", { code: error.code });
    return 0;
  }

  return Number(data ?? 0);
}
