"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PackFormState } from "@/lib/packs/actions";

/**
 * The buy button of one pack (story 10.2).
 *
 * One form per pack rather than one form with a chooser: a shop where the
 * price sits next to the button it belongs to is a shop nobody misreads.
 *
 * The confirmation is deliberate. The next screen charges a card, and a
 * misplaced thumb on a phone should not be enough to get there.
 */
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={(event) => {
        if (
          !window.confirm(
            `${label} — vous allez être redirigé vers le paiement.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Redirection…" : label}
    </Button>
  );
}

export function PackBuyForm({
  action,
  slug,
  label,
}: {
  action: (
    previous: PackFormState,
    formData: FormData,
  ) => Promise<PackFormState>;
  slug: string;
  label: string;
}) {
  const [state, formAction] = useActionState<PackFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="pack" value={slug} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <SubmitButton label={label} />
    </form>
  );
}
