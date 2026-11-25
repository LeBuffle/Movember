"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { ChallengeFormState } from "@/lib/challenges/admin-actions";

/**
 * Withdraws a challenge from the draw, or puts it back.
 *
 * Deliberately not a switch. A switch invites a stray thumb, and on this
 * screen a stray thumb removes a challenge from November. A button that says
 * what it does, and a confirmation on the way out, cost one extra tap.
 */
function ToggleButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={active ? "ghost" : "secondary"}
      size="sm"
      disabled={pending}
      onClick={(event) => {
        if (
          active &&
          !window.confirm(
            "Retirer ce défi du tirage ? Il ne sera plus attribué, mais tout ce qui a déjà été joué est conservé.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "…" : active ? "Retirer du tirage" : "Remettre en jeu"}
    </Button>
  );
}

export function ChallengeToggle({
  action,
  id,
  active,
}: {
  action: (
    previous: ChallengeFormState,
    formData: FormData,
  ) => Promise<ChallengeFormState>;
  id: string;
  active: boolean;
}) {
  const [state, formAction] = useActionState<ChallengeFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />

      <ToggleButton active={active} />

      {state.message && (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
