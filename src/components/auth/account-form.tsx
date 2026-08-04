"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOut, updateDisplayName, type FormState } from "@/lib/auth/actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
    </Button>
  );
}

export function AccountForm({ displayName }: { displayName: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateDisplayName,
    {},
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <Input
          label="Pseudonyme"
          name="displayName"
          defaultValue={displayName}
          required
          error={state.errors?.displayName}
        />
        <SaveButton />
      </form>

      {state.message && (
        <Alert tone={state.success ? "success" : "danger"}>
          {state.message}
        </Alert>
      )}

      <form action={signOut} className="border-line border-t pt-4">
        <Button type="submit" variant="ghost">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
