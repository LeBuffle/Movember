"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  NotificationDiagnosticState,
  TestSendState,
} from "@/lib/notifications/diagnostic-actions";

/**
 * Le diagnostic des notifications, et son envoi de test (story 6.9).
 *
 * Même forme que celui de Strava, volontairement : le bénévole qui dépanne en
 * novembre n'a pas à apprendre deux écrans.
 */

const MARK = { ok: "✅", warn: "⚠️", ko: "❌" } as const;

/**
 * Un bouton qui dit qu'il travaille.
 *
 * `useFormStatus` lit le formulaire *parent* : appelé dans le composant qui
 * rend le `<form>`, il ne verrait jamais rien. Sans lui, un envoi de quelques
 * secondes ressemble à un bouton mort — et c'est précisément ce qui s'est
 * passé avec les boutons de recette de l'epic 3.
 */
function PendingButton({
  idle,
  busy,
  size,
}: {
  idle: string;
  busy: string;
  size?: "sm";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" size={size} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

function Steps({
  report,
}: {
  report: NonNullable<NotificationDiagnosticState["report"]>;
}) {
  return (
    <div className="space-y-3">
      <Alert tone="info" title="Conclusion">
        {report.verdict}
      </Alert>

      <ol className="border-line divide-line divide-y border-y">
        {report.steps.map((step) => (
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
  );
}

function Results({ lines }: { lines: string[] }) {
  return (
    <Alert tone="info" title="Réponse du service de notification">
      <ul className="space-y-2">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Alert>
  );
}

export function NotificationDiagnostic({
  diagnose,
  test,
}: {
  diagnose: (
    previous: NotificationDiagnosticState,
    formData: FormData,
  ) => Promise<NotificationDiagnosticState>;
  test: (previous: TestSendState, formData: FormData) => Promise<TestSendState>;
}) {
  const [state, diagnoseAction] = useActionState<
    NotificationDiagnosticState,
    FormData
  >(diagnose, {});
  const [testState, testAction] = useActionState<TestSendState, FormData>(
    test,
    {},
  );

  return (
    <div className="space-y-5">
      <p className="text-ink-muted text-sm">
        Déroule la chaîne étape par étape sur <strong>votre</strong> compte.
        Recevoir un e-mail à la place d’une notification n’est pas une panne en
        soi — c’est ce que fait l’application pour qui n’a pas d’appareil actif.
        Ce diagnostic dit <em>pourquoi</em> vous n’en avez pas.
      </p>

      <form action={diagnoseAction}>
        <PendingButton
          idle="Lancer le diagnostic"
          busy="Diagnostic en cours…"
        />
      </form>

      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {state.report && <Steps report={state.report} />}

      <div className="border-line space-y-2 border-t pt-4">
        <form action={testAction}>
          <PendingButton
            idle="M’envoyer une notification de test"
            busy="Envoi en cours…"
          />
        </form>

        <p className="text-ink-muted text-sm">
          La seule étape qui interroge vraiment le service de notification. Elle
          ne passe pas par le registre anti-doublon : elle peut être relancée
          autant de fois que nécessaire.
        </p>

        {testState.message && <Alert tone="danger">{testState.message}</Alert>}
        {testState.lines && <Results lines={testState.lines} />}
      </div>
    </div>
  );
}

/**
 * Les deux mêmes gestes, sur la fiche d'un participant.
 *
 * **C'est la version qui servira en novembre**, quand quelqu'un écrira « je
 * n'ai pas reçu mon défi ce matin ». L'envoi de test est journalisé : il fait
 * sonner le téléphone de quelqu'un d'autre.
 */
export function ParticipantNotificationTools({
  profileId,
  diagnose,
  test,
}: {
  profileId: string;
  diagnose: (
    previous: NotificationDiagnosticState,
    formData: FormData,
  ) => Promise<NotificationDiagnosticState>;
  test: (previous: TestSendState, formData: FormData) => Promise<TestSendState>;
}) {
  const [state, diagnoseAction] = useActionState<
    NotificationDiagnosticState,
    FormData
  >(diagnose, {});
  const [testState, testAction] = useActionState<TestSendState, FormData>(
    test,
    {},
  );

  return (
    <div className="border-line mt-4 space-y-4 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        <form action={diagnoseAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <PendingButton
            idle="Diagnostiquer ses notifications"
            busy="Diagnostic…"
            size="sm"
          />
        </form>

        <form action={testAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <PendingButton idle="Lui envoyer un test" busy="Envoi…" size="sm" />
        </form>
      </div>

      <p className="text-ink-muted text-sm">
        Le diagnostic ne lit rien de plus que cette fiche. L’envoi de test fait
        sonner son téléphone, et il est journalisé.
      </p>

      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {state.report && <Steps report={state.report} />}

      {testState.message && <Alert tone="danger">{testState.message}</Alert>}
      {testState.lines && <Results lines={testState.lines} />}
    </div>
  );
}
