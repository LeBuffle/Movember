import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * How many duels are waiting for the signed-in participant.
 *
 * A single counted query, and nothing else, because it runs on the screen
 * everybody opens every morning. **A duel received runs against a clock, and
 * the clock does not stop for somebody who has not opened the right page** —
 * so the number belongs where people land, not two taps away.
 *
 * Read through their own session: the policy on `duels` is what says they see
 * the duels aimed at them and nobody else's.
 */
export async function openDuelCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from("duels")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("status", "open")
    // Expiry is swept hourly, so a duel can be past its deadline and still
    // open for a few minutes. Counting it would announce something the board
    // no longer offers.
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[défis-joueurs] défis en attente illisibles", {
      code: error.code,
    });
    return 0;
  }

  return count ?? 0;
}
