"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RefundFormState } from "@/lib/accounting/refund-actions";

/**
 * The reason, then the refund.
 *
 * The reason is required by the server whatever this form does — a required
 * attribute is a courtesy to the person filling it in, not a control. What
 * this adds is the confirmation: the action is irreversible from here, and a
 * misplaced thumb on a phone should not be enough.
 */
function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="danger"
      size="lg"
      disabled={pending || disabled}
      onClick={(event) => {
        if (
          !window.confirm(
            "Rembourser définitivement ce participant ? Son accès au jeu sera retiré.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Remboursement en cours…" : "Rembourser"}
    </Button>
  );
}

export function RefundForm({
  action,
  paymentId,
}: {
  action: (
    previous: RefundFormState,
    formData: FormData,
  ) => Promise<RefundFormState>;
  paymentId: string;
}) {
  const [state, formAction] = useActionState<RefundFormState, FormData>(
    action,
    {},
  );
  const [reason, setReason] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="paymentId" value={paymentId} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Textarea
        name="reason"
        label="Motif du remboursement"
        hint="Une phrase. Elle sera lue dans six mois par quelqu’un qui n’était pas là — « erreur », « ok » ou « demande » ne diront rien."
        value={reason}
        error={state.errors?.reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        maxLength={500}
      />

      <SubmitButton disabled={reason.trim().length < 10} />
    </form>
  );
}
