"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CreditFormState } from "@/lib/duels/credit-actions";

/**
 * The buy button of one lot of credits (story 12.2).
 *
 * One form per lot rather than one form with a chooser, exactly like the card
 * packs: a price that sits next to the button it belongs to is a price nobody
 * misreads.
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

export function CreditBuyForm({
  action,
  slug,
  label,
}: {
  action: (
    previous: CreditFormState,
    formData: FormData,
  ) => Promise<CreditFormState>;
  slug: string;
  label: string;
}) {
  const [state, formAction] = useActionState<CreditFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lot" value={slug} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <SubmitButton label={label} />
    </form>
  );
}
