"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveFlag, type ArbitrationState } from "@/lib/integrity/actions";

/**
 * Settling one case (story 9.7 AC 3).
 *
 * **Two clicks, and the reason is the second.** Press "valable" or "écarter",
 * type a line, confirm — a queue that asks for more than that is a queue
 * somebody abandons on day three.
 *
 * The reason is required, and it is the same rule as everywhere else in this
 * application where a decision touches a person: it has to be readable three
 * weeks later by somebody who did not take it.
 */

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function FlagDecision({ flagId }: { flagId: string }) {
  const [state, formAction] = useActionState<ArbitrationState, FormData>(
    resolveFlag,
    {},
  );

  const [decision, setDecision] = useState<"accepted" | "dismissed" | null>(
    null,
  );
  const reasonId = useId();

  if (!decision) {
    return (
      <div className="space-y-3">
        {state.message && <Alert tone="danger">{state.message}</Alert>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDecision("accepted")}
          >
            L’activité est valable
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDecision("dismissed")}
          >
            L’écarter
          </Button>
        </div>

        {/* Said on every case, because it is the thing an arbitrator will
            assume otherwise. */}
        <p className="text-ink-muted text-sm">
          Écarter une activité ne retire aucun point : le défi reste validé.
          Retirer des points est un geste distinct, depuis l’arbitrage des
          défis.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={flagId} />
      <input type="hidden" name="decision" value={decision} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Textarea
        id={reasonId}
        name="reason"
        label={
          decision === "accepted"
            ? "Pourquoi l’activité est valable"
            : "Pourquoi l’écarter"
        }
        hint="Obligatoire. Une phrase suffit."
        required
        minLength={3}
        maxLength={500}
        rows={2}
      />

      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          label={decision === "accepted" ? "Confirmer" : "Confirmer le retrait"}
        />
        <Button variant="ghost" onClick={() => setDecision(null)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
