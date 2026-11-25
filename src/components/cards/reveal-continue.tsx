"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { RevealState } from "@/lib/cards/reveal-actions";

/**
 * Putting the card away, and moving to the next one.
 *
 * An ordinary form pointing at a server action, which means it works before
 * the script arrives and keeps working if it never does (story 5.5 AC 6). The
 * card is not marked as seen by the page rendering: somebody who opens the
 * screen and closes it straight away gets the card offered again, which is
 * the harmless side of the two.
 */
function ContinueButton({ remaining }: { remaining: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending
        ? "…"
        : remaining > 0
          ? `Suivante (${remaining} restante${remaining > 1 ? "s" : ""})`
          : "Ajouter à ma collection"}
    </Button>
  );
}

export function RevealContinue({
  action,
  grantId,
  remaining,
}: {
  action: (previous: RevealState, formData: FormData) => Promise<RevealState>;
  grantId: string;
  remaining: number;
}) {
  const [state, formAction] = useActionState<RevealState, FormData>(action, {});

  return (
    <form action={formAction} className="mx-auto max-w-sm space-y-2">
      <input type="hidden" name="grantId" value={grantId} />

      <ContinueButton remaining={remaining} />

      {state.message && (
        <p role="alert" className="text-ink-muted text-center text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
