"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ModerationState } from "@/lib/super-teams/moderation-actions";
import type { LogoOwnerKind } from "@/lib/super-teams/moderation";

type Action = (
  previous: ModerationState,
  formData: FormData,
) => Promise<ModerationState>;

function SubmitButton({
  idle,
  variant,
}: {
  idle: string;
  variant: "ghost" | "danger" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? "…" : idle}
    </Button>
  );
}

/** Marks a logo as looked at, so it leaves the queue. */
export function ReviewedForm({
  action,
  kind,
  id,
}: {
  action: Action;
  kind: LogoOwnerKind;
  id: string;
}) {
  const [state, formAction] = useActionState<ModerationState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />

      <SubmitButton idle="Marquer comme vu" variant="secondary" />

      {state.message && (
        <p className="text-ink-muted text-sm">{state.message}</p>
      )}
    </form>
  );
}

/**
 * Taking a logo down.
 *
 * Behind one confirmation, and the confirmation says the two things that stop
 * an administrator from hesitating: the captain is told, and they may upload
 * another. A removal is not a block, and treating it as one is what makes a
 * volunteer wait for someone else to decide.
 */
export function RemoveLogoForm({
  action,
  kind,
  id,
  name,
}: {
  action: Action;
  kind: LogoOwnerKind;
  id: string;
  name: string;
}) {
  const [state, formAction] = useActionState<ModerationState, FormData>(
    action,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  if (state.done) {
    return <p className="text-ink-muted text-sm">{state.message}</p>;
  }

  if (!confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Retirer
        </Button>

        {state.message && (
          <p role="alert" className="text-danger text-sm">
            {state.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />

      <Alert tone="warning" title={`Retirer le logo de ${name} ?`}>
        Le capitaine sera prévenu et pourra en envoyer un autre. L’équipe garde
        ses membres, ses points et son rang.
      </Alert>

      <div className="flex gap-2">
        <SubmitButton idle="Retirer" variant="danger" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
