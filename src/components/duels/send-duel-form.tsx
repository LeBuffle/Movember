"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DuelFormState } from "@/lib/duels/actions";
import type { DuelType } from "@/lib/duels/catalogue";

/**
 * Choosing one of the three duels and sending it (story 12.3).
 *
 * Radio buttons rather than three separate buttons: the three duels are a
 * choice between alternatives, and a radio group is what a screen reader
 * announces as one. Three submit buttons would announce three unrelated
 * actions.
 *
 * The confirmation names the person. Sending a duel spends a credit and puts
 * somebody's name on a notification — a misplaced thumb should not be enough.
 */
function SubmitButton({ target, free }: { target: string; free: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={(event) => {
        const question = free
          ? `Riposter contre ${target} ? Cette riposte est gratuite.`
          : `Défier ${target} ? Cela utilisera un crédit.`;

        if (!window.confirm(question)) event.preventDefault();
      }}
    >
      {pending ? "Envoi…" : free ? "Riposter" : "Envoyer le défi"}
    </Button>
  );
}

export function SendDuelForm({
  action,
  types,
  receiverId,
  receiverName,
  riposteOf,
}: {
  action: (
    previous: DuelFormState,
    formData: FormData,
  ) => Promise<DuelFormState>;
  types: DuelType[];
  receiverId: string;
  receiverName: string;
  /** The duel being answered, when this is a free riposte. */
  riposteOf?: string | null;
}) {
  const [state, formAction] = useActionState<DuelFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="joueur" value={receiverId} />
      {riposteOf && <input type="hidden" name="riposte" value={riposteOf} />}

      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <fieldset className="space-y-2">
        <legend className="text-ink mb-2 font-semibold">
          Quel défi lui envoyer ?
        </legend>

        {types.map((type, index) => (
          <label
            key={type.id}
            className="border-line has-checked:border-brand-blue has-checked:bg-brand-blue-soft flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3"
          >
            <input
              type="radio"
              name="defi"
              value={type.id}
              defaultChecked={index === 0}
              className="mt-1"
              required
            />
            <span className="min-w-0">
              <span className="text-ink block font-semibold">{type.name}</span>
              <span className="text-ink-muted block text-sm">
                {type.tagline}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <SubmitButton target={receiverName} free={Boolean(riposteOf)} />
    </form>
  );
}
