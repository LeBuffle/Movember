"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { RegistrationFormState } from "@/lib/registration/actions";

/**
 * Picks an interrupted payment back up.
 *
 * A button rather than an automatic redirect. Someone who has just come back
 * from Stripe without paying — because they hesitated, or because their card
 * was refused — must not be thrown straight back into the payment page they
 * chose to leave.
 */
function ResumeButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Ouverture du paiement…" : label}
    </Button>
  );
}

export function ResumePayment({
  action,
  label = "Reprendre le paiement",
}: {
  action: (
    previous: RegistrationFormState,
    formData: FormData,
  ) => Promise<RegistrationFormState>;
  label?: string;
}) {
  const [state, formAction] = useActionState<RegistrationFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="mt-6 space-y-3">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <ResumeButton label={label} />
    </form>
  );
}
