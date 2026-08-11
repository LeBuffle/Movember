"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DuelFormState } from "@/lib/duels/actions";

/**
 * "Ne pas me défier" (story 12.4 AC 4, decision P9).
 *
 * **The cap protects against a flood, not against persistence.** Five duels a
 * day over thirty days is a hundred and fifty aimed at somebody who never
 * asked to play at this. The game is aimed at colleagues and friends who know
 * each other, and the mechanism consists of naming somebody — which is exactly
 * where a joke becomes harassment without anybody meaning it to.
 *
 * Worded positively — a box to receive, not a box to refuse — so that the
 * checked state is the ordinary one. A checkbox whose ticked state means "no"
 * is misread by roughly everybody in a hurry.
 *
 * An ordinary form pointing at a server action: it works before the script
 * arrives, and keeps working if it never does. No auto-save on toggle — a
 * setting that saves itself while you are still deciding is a setting you
 * cannot try out.
 */
function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
    </Button>
  );
}

export function DuelOptOutForm({
  action,
  optedOut,
}: {
  action: (
    previous: DuelFormState,
    formData: FormData,
  ) => Promise<DuelFormState>;
  optedOut: boolean;
}) {
  const [state, formAction] = useActionState<DuelFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name="recevoir"
          defaultChecked={!optedOut}
          className="mt-1"
        />
        <span className="text-ink text-sm">
          J’accepte de recevoir des défis d’autres participants.
          <span className="text-ink-muted block">
            Vous pouvez en envoyer dans tous les cas, et couper la réception à
            tout moment.
          </span>
        </span>
      </label>

      <SaveButton />
    </form>
  );
}
