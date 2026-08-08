import "server-only";

import { countManualActivities } from "@/lib/activities/store";
import { createClient } from "@/lib/supabase/server";

/**
 * How many of *my* outings were typed in by hand (story 9.8).
 *
 * A separate entry point from `countManualActivities`, which takes an
 * identifier and goes through the service key: this one reads the identifier
 * from the session and can therefore never be asked about somebody else.
 */
export async function ownManualCount(): Promise<number> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  return countManualActivities(user.id);
}
