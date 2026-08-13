"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DiagnosticState } from "@/lib/activities/diagnostic-actions";

/**
 * The button that walks the Strava chain (runbook §12 quinquies).
 *
 * **On demand, never on page load.** The last step spends one call against
 * the quota shared by every participant — acceptable when somebody asks,
 * wasteful on every refresh of a back-office screen.
 */

function RunButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Diagnostic en cours…" : "Lancer le diagnostic"}
    </Button>
  );
}

const MARK = { ok: "✅", warn: "⚠️", ko: "❌" } as const;

export function StravaDiagnostic({
  action,
}: {
  action: (
    previous: DiagnosticState,
    formData: FormData,
  ) => Promise<DiagnosticState>;
}) {
  const [state, formAction] = useActionState<DiagnosticState, FormData>(
    action,
    {},
  );

  return (
    <div className="space-y-4">
      <p className="text-ink-muted text-sm">
        Déroule la chaîne étape par étape sur <strong>votre</strong> compte, et
        dit où elle s’arrête. Quatre des six étapes n’appellent jamais Strava —
        c’est pourquoi une panne peut exister sans qu’aucune requête
        n’apparaisse dans votre tableau de bord Strava.
      </p>

      <form action={formAction}>
        <RunButton />
      </form>

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {state.report && (
        <div className="space-y-3">
          <Alert tone="info" title="Conclusion">
            {state.report.verdict}
          </Alert>

          <ol className="border-line divide-line divide-y border-y">
            {state.report.steps.map((step) => (
              <li key={step.label} className="py-3">
                <p className="text-ink font-medium">
                  <span aria-hidden>{MARK[step.state]} </span>
                  {step.label}
                </p>
                <p className="text-ink-muted mt-1 text-sm">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
