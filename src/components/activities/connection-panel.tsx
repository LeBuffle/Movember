"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SyncFormState } from "@/lib/activities/sync-actions";

/**
 * The two things a participant can do about their own link.
 *
 * **Relaunching is a button that reassures, even when it changes nothing.**
 * "Is my run from this morning counted?" is the question this whole screen
 * exists to answer without anybody writing in — and the server refuses a
 * second attempt within five minutes, because somebody waiting will press it
 * ten times and ten calls per person eat the quota for everybody.
 */
function Pending({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function Resynchronise({
  action,
}: {
  action: (
    previous: SyncFormState,
    formData: FormData,
  ) => Promise<SyncFormState>;
}) {
  const [state, formAction] = useActionState<SyncFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      {state.message && <Alert tone="info">{state.message}</Alert>}

      {/* Réservé à l'organisation : renvoyé vide pour tout le monde d'autre
          (voir `adminDetail`). Un participant n'a rien à faire d'un code
          HTTP ; celui qui doit réparer, si. */}
      {state.detail && (
        <p className="text-ink-muted mt-2 text-sm">{state.detail}</p>
      )}

      {state.stored !== undefined && (
        <Alert tone="success">
          {state.stored === 0
            ? "Rien de nouveau : vos sorties étaient déjà à jour."
            : `${state.stored} nouvelle${state.stored > 1 ? "s" : ""} sortie${state.stored > 1 ? "s" : ""} récupérée${state.stored > 1 ? "s" : ""}.`}
        </Alert>
      )}

      <Pending label="Vérifier maintenant" busy="Vérification…" />
    </form>
  );
}

/**
 * Disconnecting, with what it does said before it happens.
 *
 * The confirmation names the two things people get wrong: the authorisation
 * really is withdrawn at Strava, and what has already been earned stays.
 */
export function Disconnect({
  action,
}: {
  action: (
    previous: SyncFormState,
    formData: FormData,
  ) => Promise<SyncFormState>;
}) {
  const [state, formAction] = useActionState<SyncFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <DisconnectButton />
    </form>
  );
}

function DisconnectButton() {
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
            "Déconnecter Strava ? L’autorisation sera retirée chez Strava et vos sorties ne seront plus récupérées. Vos défis déjà réussis et vos points restent acquis.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Déconnexion…" : "Déconnecter mon compte Strava"}
    </Button>
  );
}
