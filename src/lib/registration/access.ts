import "server-only";

import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationStatus } from "@/types/database";

/**
 * Who may reach the game.
 *
 * **Nothing in the game opens before a registration is `active`** (FR12), and
 * `active` is set by the Stripe webhook alone (story 2.4). Which makes this
 * the counterpart of that story: the webhook decides, this decides who the
 * decision lets in.
 *
 * Read through the participant's **own session**, so row level security is
 * what answers the question. The service key would work too and would mean
 * this function is the only thing standing between someone and the game —
 * a protection that holds only as long as every future page remembers to
 * call it. Three layers, as on the back-office (story 1.10): the middleware
 * requires a session, this requires a paid one, and the database refuses the
 * rows either way.
 */

export type ParticipantAccess = {
  signedIn: boolean;
  status: RegistrationStatus | null;
  /** The only field a caller should branch on. */
  isActive: boolean;
};

export async function getParticipantAccess(): Promise<ParticipantAccess> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { signedIn: false, status: null, isActive: false };

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) return { signedIn: true, status: null, isActive: false };

  const { data } = await supabase
    .from("registrations")
    .select("status")
    .eq("profile_id", user.id)
    .eq("edition_id", edition.id)
    .maybeSingle();

  const status = data?.status ?? null;

  // Named explicitly rather than `status !== "pending"`. A registration that
  // was refunded or cancelled is not pending either, and must not open
  // anything.
  return { signedIn: true, status, isActive: status === "active" };
}
