import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Records an administrative action.
 *
 * Nothing calls this yet — the back-office screens arrive with epics 4, 5, 6
 * and 9. It exists now so that each of them finds one way of logging rather
 * than inventing its own, and so that the awkward decisions below are made
 * once.
 *
 * Written through the administrator's own session, not the service key. Row
 * level security then enforces two things the application cannot be trusted
 * to enforce alone: that the caller is an admin, and that the entry is filed
 * under their own name. `admin_id` is not even a parameter — it is read from
 * the session, so there is no way to pass someone else's.
 */
export type AdminAuditEntry = {
  /** Verb, dotted: `challenge.published`, `payment.refunded`. */
  action: string;
  targetTable?: string;
  targetId?: string;
  /**
   * Context of the action.
   *
   * **Never personal data.** An audit entry outlives the account it refers
   * to, so an e-mail address copied in here would survive that person's
   * erasure request. Record the identifier, not the person.
   */
  payload?: Record<string, unknown>;
};

/**
 * @returns whether the entry was persisted.
 *
 * Does not throw, and that is a deliberate trade-off. An administrative
 * action that succeeded must not be reported to a volunteer as having failed
 * because its journal entry did not save — during November, someone
 * cancelling a challenge from their phone on a poor connection needs the
 * cancellation, not a stack trace. The failure is written to the server log,
 * where the supervision of story 1.11 will pick it up.
 *
 * The caller decides what to do with `false`. For an action where the trace
 * matters more than the action itself — a refund, say — refusing to proceed
 * without a log is the right call, and epic 9 will make it.
 */
export async function logAdminAction(entry: AdminAuditEntry): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[audit] action non journalisée : aucune session", {
      action: entry.action,
    });
    return false;
  }

  const { error } = await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    payload: entry.payload ?? {},
  });

  if (error) {
    console.error("[audit] action non journalisée", {
      action: entry.action,
      code: error.code,
      message: error.message,
    });
    return false;
  }

  return true;
}
