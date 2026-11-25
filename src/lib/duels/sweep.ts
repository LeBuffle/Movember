import "server-only";

import { EXPIRY_MESSAGE_KEYS } from "@/lib/duels/messages";
import { notifyDuelEndingSoon, notifyDuelExpired } from "@/lib/duels/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The hourly pass over duels in flight (stories 12.5 and 12.7).
 *
 * Two jobs, and the order matters: expire first, then remind. Reminding
 * somebody about a duel that expired four minutes ago would be the single
 * most irritating message the application could send.
 *
 * **Expiry is silent for the person who received the duel** (story 12.5
 * AC 7). No penalty, no point lost, no message. They did not ask for it. The
 * sender gets a sentence, with humour and without mockery, and that is all
 * that happens.
 */

export type SweepReport = {
  expired: number;
  reminded: number;
};

/**
 * How long before the deadline the reminder goes out.
 *
 * Four hours: long enough to still be able to do something about it — a run
 * fits in four hours, and so does the decision not to bother — and short
 * enough that it is not just a second notification about the same thing.
 */
const REMINDER_HOURS = 4;

/** A bound on one pass. Well above anything a real evening can produce. */
const MAX_PER_PASS = 200;

export async function sweepDuels(): Promise<SweepReport> {
  const admin = createAdminClient();

  /* Which duels are about to expire is read BEFORE the expiry runs, so that
     the expiry cannot swallow the ones it is about to close. */
  const { data: expiring } = await admin
    .from("duels")
    .select("id")
    .eq("status", "open")
    .lte(
      "expires_at",
      new Date(Date.now() + REMINDER_HOURS * 3_600_000).toISOString(),
    )
    .gt("expires_at", new Date().toISOString())
    .limit(MAX_PER_PASS);

  const { data: closed, error } = await admin.rpc("expire_duels", {
    p_message_keys: EXPIRY_MESSAGE_KEYS,
  });

  if (error) {
    console.error("[défis-joueurs] expiration impossible", {
      code: error.code,
    });
    return { expired: 0, reminded: 0 };
  }

  const expired = Number(closed ?? 0);

  /* The senders are told after the fact, and only about duels closed on this
     pass. Read back rather than returned by the function: the sentence drawn
     is stored on the row, and reading it is what makes the notification and
     the screen say the same thing. */
  if (expired > 0) {
    const { data: rows } = await admin
      .from("duels")
      .select("id")
      .eq("status", "expired")
      .gte("expires_at", new Date(Date.now() - 26 * 3_600_000).toISOString())
      .limit(MAX_PER_PASS);

    for (const row of rows ?? []) {
      // `notify` claims each send under a key built from the duel, so a
      // second pass over the same rows sends nothing.
      await notifyDuelExpired(row.id);
    }
  }

  let reminded = 0;

  for (const row of expiring ?? []) {
    await notifyDuelEndingSoon(row.id);
    reminded += 1;
  }

  console.info("[défis-joueurs] passage effectué", { expired, reminded });

  return { expired, reminded };
}
