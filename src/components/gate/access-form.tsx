"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccessFormState } from "@/lib/gate/actions";

/**
 * One field, and a phone keyboard that helps rather than hinders.
 *
 * `type="password"` so a shoulder does not read it, and no autocapitalise or
 * autocorrect: a phone helpfully turning `moustache` into `Moustache` is
 * exactly how somebody ends up convinced the code is wrong.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Vérification…" : "Entrer"}
    </Button>
  );
}

export function AccessForm({
  action,
  next,
}: {
  action: (
    previous: AccessFormState,
    formData: FormData,
  ) => Promise<AccessFormState>;
  next?: string;
}) {
  const [state, formAction] = useActionState<AccessFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="suite" value={next ?? "/"} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Input
        name="code"
        type="password"
        label="Code d’accès"
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />

      <SubmitButton />
    </form>
  );
}
