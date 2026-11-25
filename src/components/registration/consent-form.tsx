"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { RegistrationFormState } from "@/lib/registration/actions";

function Checkbox({
  name,
  error,
  children,
}: {
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* The whole line is the target, not just the 16-pixel square. On a
          phone, a checkbox alone is the hardest control to hit there is. */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={name}
          aria-describedby={error ? `${name}-erreur` : undefined}
          aria-invalid={error ? true : undefined}
          className="accent-brand-blue mt-1 h-5 w-5 shrink-0"
        />
        <span className="text-ink text-sm">{children}</span>
      </label>

      {error && (
        <p id={`${name}-erreur`} className="text-danger mt-1 ml-8 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Un instant…" : "Continuer vers le paiement"}
    </Button>
  );
}

/**
 * The two acceptances required before paying.
 *
 * **Two boxes, not one.** A single "I accept the terms and acknowledge this
 * is not a tax-deductible donation" gets ticked without being read. Two
 * separate boxes force the two statements to be handled separately — and it
 * is the second that protects the association from someone asking for a tax
 * receipt in April (FR14, PRD D6).
 *
 * Neither is pre-ticked, and neither can be skipped: the server checks them
 * again, because a checkbox is a hint to the user, not a control.
 */
export function ConsentForm({
  action,
  tierSlug,
}: {
  action: (
    previous: RegistrationFormState,
    formData: FormData,
  ) => Promise<RegistrationFormState>;
  tierSlug: string;
}) {
  const [state, formAction] = useActionState<RegistrationFormState, FormData>(
    action,
    {},
  );
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tier" value={tierSlug} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Checkbox name="cgv" error={errors.cgv}>
        J’accepte les{" "}
        <Link
          href="/cgv"
          target="_blank"
          className="text-brand-blue underline underline-offset-4"
        >
          conditions générales de vente
        </Link>
        .
      </Checkbox>

      <Checkbox name="fiscal" error={errors.fiscal}>
        Je comprends que mon inscription est un{" "}
        <strong>achat avec contrepartie</strong> et{" "}
        <strong>non un don défiscalisable</strong> : aucun reçu fiscal ne me
        sera délivré et ce montant n’ouvre droit à aucune réduction d’impôt.
      </Checkbox>

      <SubmitButton />
    </form>
  );
}
