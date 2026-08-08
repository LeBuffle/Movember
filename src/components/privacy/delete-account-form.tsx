"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeletionFormState } from "@/lib/privacy/actions";

/**
 * Asking for erasure (story 11.2).
 *
 * Retyping the pseudonym, then a confirmation dialog. Two steps for one
 * irreversible action, on a screen most people reach on a phone.
 *
 * Neither step is a security control — the person doing this owns the account.
 * They exist so that nobody erases a month of sport with a misplaced thumb.
 */
function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="danger"
      size="lg"
      disabled={pending || disabled}
      onClick={(event) => {
        if (
          !window.confirm(
            "Effacer définitivement votre compte ? Vos activités, vos défis et vos cartes seront supprimés. C’est irréversible.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Effacement en cours…" : "Effacer mon compte"}
    </Button>
  );
}

export function DeleteAccountForm({
  action,
  displayName,
}: {
  action: (
    previous: DeletionFormState,
    formData: FormData,
  ) => Promise<DeletionFormState>;
  displayName: string;
}) {
  const [state, formAction] = useActionState<DeletionFormState, FormData>(
    action,
    {},
  );
  const [typed, setTyped] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Input
        name="confirmation"
        label="Recopiez votre pseudonyme pour confirmer"
        hint={`Écrivez « ${displayName} ».`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
      />

      <SubmitButton disabled={typed.trim() !== displayName} />
    </form>
  );
}
