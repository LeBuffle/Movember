"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

/**
 * What is left of the account form: the way out.
 *
 * **The pseudonym is no longer editable here.** It is chosen when the
 * account is created and does not change — it is the participant's public
 * identity, printed in seven rankings, on team pages and in the history.
 * Somebody who renames themselves mid-month vanishes for their teammates,
 * who are looking for a name that no longer exists.
 *
 * The rule is carried by a database trigger, not by this file: removing a
 * form removes a door, not a capability (story 1.13).
 */
export function AccountForm() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost">
        Se déconnecter
      </Button>
    </form>
  );
}
