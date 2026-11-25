"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ConsentFormState } from "@/lib/activities/consent-actions";

/**
 * One box, never pre-ticked.
 *
 * A pre-ticked box is not a consent — it is a decision taken by whoever
 * wrote the form, on behalf of somebody who did not read it. That is the
 * whole reason this component exists rather than a plain button: the act of
 * ticking is the consent, and the button only records it.
 *
 * The server checks the box again whatever this does. Everything here is a
 * courtesy to the person filling it in, not a control.
 */
function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending || disabled}>
      {pending ? "Enregistrement…" : "J’autorise"}
    </Button>
  );
}

export function ConsentForm({
  action,
}: {
  action: (
    previous: ConsentFormState,
    formData: FormData,
  ) => Promise<ConsentFormState>;
}) {
  const [state, formAction] = useActionState<ConsentFormState, FormData>(
    action,
    {},
  );
  const [ticked, setTicked] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <label className="border-line bg-surface flex cursor-pointer gap-3 rounded-lg border p-4">
        <input
          type="checkbox"
          name="consent"
          checked={ticked}
          onChange={(event) => setTicked(event.target.checked)}
          className="mt-1"
        />
        <span className="text-ink text-sm">
          J’autorise DEFI Movember à récupérer mes activités sportives auprès de
          mon compte Strava, dans les limites décrites ci-dessus, pour la durée
          de l’édition.
        </span>
      </label>

      <SubmitButton disabled={!ticked} />
    </form>
  );
}

/**
 * Withdrawing, on the same screen as granting.
 *
 * Not buried in a settings page three levels down. A consent that is easy to
 * give and hard to take back is not a free consent.
 */
export function WithdrawConsent({
  action,
}: {
  action: (
    previous: ConsentFormState,
    formData: FormData,
  ) => Promise<ConsentFormState>;
}) {
  const [state, formAction] = useActionState<ConsentFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {/* A withdrawal that silently fails is the worst of both worlds: the
          person believes it stopped, and it did not. */}
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <WithdrawButton />
    </form>
  );
}

/**
 * Its own component so that `useFormStatus` has a form above it to read —
 * called in the component that renders the `<form>`, it reports nothing.
 */
function WithdrawButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={(event) => {
        if (
          !window.confirm(
            "Retirer votre autorisation ? Vos sorties ne seront plus récupérées et votre compte sportif sera délié.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      Retirer mon autorisation
    </Button>
  );
}
