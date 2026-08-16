"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  liftSuspension,
  suspendParticipant,
  type SuspensionState,
} from "@/lib/admin/suspension";

/**
 * Setting somebody aside, and bringing them back (story 8.7).
 *
 * **Two presses, never one.** The button is not a suspend button — it opens
 * the form that asks for a reason, and the reason is what makes the second
 * press deliberate. A single red button on a support record is a button that
 * gets pressed by a thumb scrolling on a phone.
 *
 * Lifting, by contrast, is one press. The asymmetry is the point: undoing
 * something must never be harder than doing it.
 */

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "danger" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function SuspensionForm({
  participantId,
  suspended,
}: {
  participantId: string;
  suspended: { since: string; reason: string; by: string | null } | null;
}) {
  const [suspendState, suspendAction] = useActionState<
    SuspensionState,
    FormData
  >(suspendParticipant, {});
  const [liftState, liftAction] = useActionState<SuspensionState, FormData>(
    liftSuspension,
    {},
  );

  const [open, setOpen] = useState(false);
  const reasonId = useId();

  if (suspended) {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="Ce participant est suspendu">
          <p>
            Depuis le {formatMoment(suspended.since)}. Son inscription et son
            paiement sont intacts — seule la suspension a été posée.
          </p>
          <p className="mt-2">
            <span className="font-semibold">Motif :</span> {suspended.reason}
          </p>
        </Alert>

        {liftState.message && <Alert tone="danger">{liftState.message}</Alert>}

        <form action={liftAction}>
          <input type="hidden" name="id" value={participantId} />
          <SubmitButton
            label="Lever la suspension"
            pendingLabel="Levée…"
            variant="secondary"
          />
        </form>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <p className="text-ink-muted text-sm">
          Écarter ce participant du jeu et des classements. Son inscription et
          son paiement restent intacts : un remboursement est une décision
          distincte, à prendre depuis l’écran de la collecte.
        </p>

        {suspendState.message && (
          <Alert tone="danger">{suspendState.message}</Alert>
        )}

        <Button variant="ghost" onClick={() => setOpen(true)}>
          Suspendre ce participant…
        </Button>
      </div>
    );
  }

  return (
    <form action={suspendAction} className="space-y-4">
      <input type="hidden" name="id" value={participantId} />

      {suspendState.message && (
        <Alert tone="danger">{suspendState.message}</Alert>
      )}

      <Alert tone="warning" title="Ce que fait une suspension">
        Le participant n’accède plus au jeu et disparaît des classements. Il
        voit un message l’invitant à écrire à l’organisation. Rien n’est
        remboursé, et la suspension peut être levée à tout moment.
      </Alert>

      <Textarea
        id={reasonId}
        name="reason"
        label="Motif"
        hint="Obligatoire. Il sera relu par quelqu’un qui n’a pas pris la décision — écrivez ce qu’il faut pour qu’il comprenne."
        required
        minLength={3}
        maxLength={500}
        rows={3}
      />

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          label="Confirmer la suspension"
          pendingLabel="Suspension…"
          variant="danger"
        />
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function formatMoment(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
