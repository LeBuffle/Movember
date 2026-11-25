import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sending a duel (stories 12.3 and 12.4).
 *
 * **The debit and the duel cannot be two writes.** A credit taken with no duel
 * sent is a complaint; a duel sent with no credit taken is a hole. Both happen
 * inside `send_duel`, in one transaction, and every refusal happens before
 * anything is written — so a refused send costs nothing at all rather than
 * costing a credit that then has to be handed back.
 *
 * **Every check is on the server, including the ones the screen already
 * makes.** The button is hidden for somebody who has switched duels off; that
 * is a politeness. A forged request meets the same refusal, from the database
 * function, because a hidden button protects nobody.
 */

export type SendStatus =
  | "ok"
  | "self"
  | "type-unavailable"
  | "receiver-unavailable"
  | "opted-out"
  | "capped"
  | "no-credit"
  | "riposte-invalid"
  | "already-riposted"
  | "error";

export type SendOutcome = {
  status: SendStatus;
  duelId?: string;
  expiresAt?: string;
  free?: boolean;
  balance?: number;
};

export type SendRequest = {
  senderId: string;
  receiverId: string;
  editionId: string;
  duelTypeId: string;
  /** The duel being answered, for a free riposte. */
  parentDuelId?: string | null;
};

/**
 * What each refusal is worth saying, in French.
 *
 * Written here rather than in the screen so the wording cannot drift between
 * the ranking and the duel page. **None of them blames the reader**, and the
 * cap one is the PO's own sentence: somebody refused because a stranger is
 * popular has done nothing wrong.
 */
export const SEND_MESSAGES: Record<Exclude<SendStatus, "ok">, string> = {
  self: "On ne peut pas se défier soi-même. Choisissez quelqu’un d’autre.",
  "type-unavailable":
    "Ce défi n’est plus disponible. Rechargez la page et réessayez.",
  "receiver-unavailable":
    "Ce participant ne peut pas recevoir de défi pour le moment. Votre crédit n’a pas été utilisé.",
  "opted-out":
    "Ce participant a choisi de ne pas recevoir de défis. Votre crédit n’a pas été utilisé.",
  capped:
    "Désolé, ce joueur a déjà reçu trop de défis aujourd’hui. Retentez demain — votre crédit n’a pas été utilisé.",
  "no-credit":
    "Il vous faut un crédit pour envoyer un défi. Vous pouvez en acheter par lot.",
  "riposte-invalid":
    "Cette riposte n’est plus possible : elle ne répond à aucun défi que vous avez relevé.",
  "already-riposted": "Vous avez déjà riposté à ce défi. Une seule par défi.",
  error: "Le défi n’a pas pu partir. Réessayez dans un instant.",
};

export async function sendDuel(request: SendRequest): Promise<SendOutcome> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("send_duel", {
    p_sender: request.senderId,
    p_receiver: request.receiverId,
    p_edition: request.editionId,
    p_duel_type: request.duelTypeId,
    p_parent: request.parentDuelId ?? null,
  });

  if (error) {
    console.error("[défis-joueurs] envoi impossible", {
      code: error.code,
      message: error.message,
    });
    return { status: "error" };
  }

  const outcome = (data ?? {}) as {
    status?: string;
    duel_id?: string;
    expires_at?: string;
    free?: boolean;
    balance?: number;
  };

  const status = (outcome.status ?? "error") as SendStatus;

  return {
    status,
    duelId: outcome.duel_id,
    expiresAt: outcome.expires_at,
    free: outcome.free,
    balance: outcome.balance,
  };
}
