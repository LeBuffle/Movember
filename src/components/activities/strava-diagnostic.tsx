"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  DiagnosticState,
  ReimportState,
} from "@/lib/activities/diagnostic-actions";

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

/**
 * Deux gestes que la recette réclame et qui n'existaient nulle part.
 *
 * **L'import complet ne tourne qu'une fois**, au moment où le compte est
 * relié ; le bouton de resynchronisation regarde deux jours en arrière. Une
 * liaison faite avant l'ouverture de l'édition ne rattrape donc jamais son
 * début de mois.
 *
 * **Et rien ne recalcule un classement à la demande** — c'est le principe de
 * la vue matérialisée. Un défi validé reste donc invisible jusqu'à la passe
 * suivante, ce qui se lit « le classement est cassé » en pleine répétition.
 */
export function RehearsalTools({
  reimport,
  refresh,
}: {
  reimport: (
    previous: ReimportState,
    formData: FormData,
  ) => Promise<ReimportState>;
  refresh: (
    previous: ReimportState,
    formData: FormData,
  ) => Promise<ReimportState>;
}) {
  const [importState, importAction] = useActionState<ReimportState, FormData>(
    reimport,
    {},
  );
  const [refreshState, refreshAction] = useActionState<ReimportState, FormData>(
    refresh,
    {},
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <form action={importAction}>
          <Button type="submit" variant="secondary">
            Réimporter mes sorties depuis le début de l’édition
          </Button>
        </form>

        <p className="text-ink-muted text-sm">
          Le bouton « Vérifier maintenant » d’un participant ne regarde que les
          deux derniers jours. Celui-ci reprend tout depuis le premier jour de
          l’édition.
        </p>

        {importState.message && (
          <Alert tone="info">{importState.message}</Alert>
        )}
      </div>

      <div className="space-y-2">
        <form action={refreshAction}>
          <Button type="submit" variant="secondary">
            Recalculer les classements maintenant
          </Button>
        </form>

        <p className="text-ink-muted text-sm">
          Les classements se recalculent tout seuls toutes les quinze minutes.
          Un défi validé reste invisible jusque-là.
        </p>

        {refreshState.message && (
          <Alert tone="info">{refreshState.message}</Alert>
        )}
      </div>
    </div>
  );
}

/**
 * Les deux gestes de dépannage, sur la fiche d'un participant.
 *
 * **C'est la version qui servira en novembre.** Un bénévole ne diagnostique
 * pas sa propre liaison pendant l'édition : il répond à « ma sortie de
 * dimanche n'a pas compté », et celui qui se plaint n'est jamais lui.
 *
 * L'identifiant voyage dans le formulaire, ce qui est acceptable ici et ne
 * l'était pas sur l'écran d'apparence d'une super-équipe : là-bas il aurait
 * permis d'agir sur la fédération d'un autre, ici c'est précisément le
 * travail, et il passe par `requireAdmin`.
 */
export function ParticipantStravaTools({
  profileId,
  diagnose,
  reimport,
}: {
  profileId: string;
  diagnose: (
    previous: DiagnosticState,
    formData: FormData,
  ) => Promise<DiagnosticState>;
  reimport: (
    previous: ReimportState,
    formData: FormData,
  ) => Promise<ReimportState>;
}) {
  const [diagState, diagAction] = useActionState<DiagnosticState, FormData>(
    diagnose,
    {},
  );
  const [importState, importAction] = useActionState<ReimportState, FormData>(
    reimport,
    {},
  );

  return (
    <div className="border-line mt-4 space-y-4 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        <form action={diagAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <Button type="submit" variant="secondary" size="sm">
            Diagnostiquer sa liaison
          </Button>
        </form>

        <form action={importAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <Button type="submit" variant="secondary" size="sm">
            Réimporter ses sorties
          </Button>
        </form>
      </div>

      <p className="text-ink-muted text-sm">
        Le diagnostic ne lit rien de plus que cette fiche. Le réimport reprend
        ses sorties depuis le premier jour de l’édition, et il est journalisé.
      </p>

      {diagState.message && <Alert tone="danger">{diagState.message}</Alert>}
      {importState.message && <Alert tone="info">{importState.message}</Alert>}

      {diagState.report && (
        <div className="space-y-3">
          <Alert tone="info" title="Conclusion">
            {diagState.report.verdict}
          </Alert>

          <ol className="border-line divide-line divide-y border-y">
            {diagState.report.steps.map((step) => (
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
