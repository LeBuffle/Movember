"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SimulationFormState } from "@/lib/activities/actions";

/**
 * Injecting the made-up activities, from a phone.
 *
 * One button and no options, on purpose. The value of this tool is that it
 * takes three seconds to answer "does the engine still work end to end?" —
 * a form with a participant picker and a date range would answer the same
 * question in two minutes and get used half as often.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Injection en cours…" : "Injecter les activités simulées"}
    </Button>
  );
}

export function SimulatedActivities({
  action,
  day,
}: {
  action: (
    previous: SimulationFormState,
    formData: FormData,
  ) => Promise<SimulationFormState>;
  day: string;
}) {
  const [state, formAction] = useActionState<SimulationFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="day" value={day} />

      {state.message && <Alert tone="info">{state.message}</Alert>}

      {state.report && (
        <Alert tone="success" title="Activités injectées">
          {state.report.stored} activité
          {state.report.stored > 1 ? "s" : ""} ajoutée
          {state.report.stored > 1 ? "s" : ""} sur {state.report.received}, et{" "}
          {state.report.completed} défi
          {state.report.completed > 1 ? "s" : ""} validé
          {state.report.completed > 1 ? "s" : ""}.
        </Alert>
      )}

      <SubmitButton />
    </form>
  );
}
