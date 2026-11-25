"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ArbitrationFormState } from "@/lib/challenges/arbitration-actions";

/**
 * The decision, then the reason, then the button.
 *
 * Two radio buttons rather than two submit buttons, and neither pre-selected.
 * "Valider" and "invalider" have opposite consequences on somebody's rank; a
 * form that arrives with one already chosen makes that choice for whoever is
 * in a hurry, and it would be the wrong one half the time.
 *
 * The reason is required by the server whatever this form does — everything
 * here is a courtesy to the person filling it in, not a control.
 */
function SubmitButton({
  disabled,
  decision,
}: {
  disabled: boolean;
  decision: string;
}) {
  const { pending } = useFormStatus();

  const label = decision === "invalidate" ? "Invalider" : "Valider";

  return (
    <Button
      type="submit"
      variant={decision === "invalidate" ? "danger" : "primary"}
      size="lg"
      disabled={pending || disabled}
      onClick={(event) => {
        if (
          !window.confirm(
            decision === "invalidate"
              ? "Retirer ce défi et ses points au participant ?"
              : "Valider ce défi et accorder ses points au participant ?",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

export function ArbitrationForm({
  action,
  assignmentId,
  status,
}: {
  action: (
    previous: ArbitrationFormState,
    formData: FormData,
  ) => Promise<ArbitrationFormState>;
  assignmentId: string;
  status: "open" | "completed" | "missed";
}) {
  const [state, formAction] = useActionState<ArbitrationFormState, FormData>(
    action,
    {},
  );
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <fieldset className="space-y-2">
        <legend className="text-ink text-sm font-medium">Décision</legend>

        <Choice
          name="decision"
          value="validate"
          checked={decision === "validate"}
          onChange={setDecision}
          disabled={status === "completed"}
          title="Valider le défi"
          detail={
            status === "completed"
              ? "Ce défi est déjà validé."
              : "Le défi passe à « réussi » et ses points sont accordés."
          }
        />

        <Choice
          name="decision"
          value="invalidate"
          checked={decision === "invalidate"}
          onChange={setDecision}
          disabled={status === "missed"}
          title="Invalider le défi"
          detail={
            status === "missed"
              ? "Ce défi est déjà invalidé."
              : "Le défi passe à « manqué » et ses points sont retirés. Il ne se revalidera pas tout seul."
          }
        />

        {state.errors?.decision && (
          <p className="text-danger text-sm">{state.errors.decision}</p>
        )}
      </fieldset>

      <Textarea
        name="reason"
        label="Motif"
        hint="Une phrase. Elle sera lue dans deux mois par quelqu’un qui n’était pas là — « erreur » ou « ok » ne diront rien."
        value={reason}
        error={state.errors?.reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        maxLength={500}
      />

      <SubmitButton
        decision={decision}
        disabled={decision === "" || reason.trim().length < 10}
      />
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  disabled,
  title,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  disabled: boolean;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={[
        "border-line flex min-h-11 gap-3 rounded-lg border p-3",
        disabled ? "opacity-50" : "cursor-pointer",
        checked ? "border-brand-blue bg-brand-blue-soft" : "bg-surface",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1"
      />
      <span>
        <span className="text-ink block text-sm font-medium">{title}</span>
        <span className="text-ink-muted block text-sm">{detail}</span>
      </span>
    </label>
  );
}
