"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DrawActionState } from "@/lib/challenges/admin-actions";

/**
 * The button for the morning the challenges did not go out.
 *
 * No confirmation, and that is on purpose — unlike the refund. Pressing it
 * twice changes nothing, so an extra question would only add a step to
 * somebody already worried, on a phone, before breakfast.
 */
function RunButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Attribution en cours…" : "Lancer l’attribution du jour"}
    </Button>
  );
}

export function DrawRunner({
  action,
}: {
  action: (
    previous: DrawActionState,
    formData: FormData,
  ) => Promise<DrawActionState>;
}) {
  const [state, formAction] = useActionState<DrawActionState, FormData>(
    action,
    {},
  );

  const report = state.report;

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <RunButton />

      {report && (
        <Alert
          tone={report.failures > 0 ? "danger" : "success"}
          title={`Attribution du ${report.date}`}
        >
          <ul className="space-y-1">
            <li>{report.participants} participants actifs</li>
            <li>
              <strong>{report.assigned}</strong> défis attribués
              {report.catchUps > 0 &&
                ` — dont ${report.catchUps} en rattrapage, faute de défis nouveaux`}
            </li>
            <li>{report.alreadyHad} avaient déjà leur défi du jour</li>
            {report.failures > 0 && (
              <li className="text-danger font-semibold">
                {report.failures} sans défi — voir les journaux
              </li>
            )}
          </ul>

          {report.warning && <p className="mt-2">{report.warning}</p>}
        </Alert>
      )}
    </form>
  );
}
