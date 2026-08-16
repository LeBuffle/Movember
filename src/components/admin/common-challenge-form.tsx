"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CommonFormState } from "@/lib/challenges/admin-actions";

/**
 * Scheduling the challenge everybody gets that day.
 *
 * The mode is a required choice with no default selected. Both readings make
 * sense — "instead of" lightens the day, "in addition to" loads it — and a
 * pre-selected option is a decision made by whoever wrote the form rather
 * than by whoever runs the animation.
 */
const MODES = [
  { value: "additional", label: "En plus du défi du jour" },
  { value: "replace", label: "À la place du défi du jour" },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Programmation…" : "Programmer"}
    </Button>
  );
}

export function CommonChallengeForm({
  action,
  challenges,
}: {
  action: (
    previous: CommonFormState,
    formData: FormData,
  ) => Promise<CommonFormState>;
  challenges: Array<{ value: string; label: string }>;
}) {
  const [state, formAction] = useActionState<CommonFormState, FormData>(
    action,
    {},
  );

  const errors = state.errors ?? {};

  if (challenges.length === 0) {
    return (
      <Alert tone="info" title="Aucun défi disponible">
        Créez d’abord un défi dans le catalogue : un défi commun se choisit
        parmi ceux qui existent.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {state.scheduled && (
        <Alert tone="success" title="Défi commun programmé">
          Il sera attribué à tout le monde le matin venu.
        </Alert>
      )}

      <Select
        name="challengeId"
        label="Défi"
        options={challenges}
        placeholder="Choisir un défi…"
        error={errors.challengeId}
        defaultValue=""
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="scheduledFor"
          label="Date"
          type="date"
          hint="Le jour où tout le monde le recevra."
          error={errors.scheduledFor}
        />

        <Select
          name="mode"
          label="En plus, ou à la place ?"
          hint="Les deux se défendent : à la place allège la journée, en plus la charge."
          options={MODES}
          placeholder="Choisir…"
          error={errors.mode}
          defaultValue=""
        />
      </div>

      <SubmitButton />
    </form>
  );
}

/** Calling one off, while the day is still ahead. */
export function CancelCommonChallenge({
  action,
  id,
}: {
  action: (
    previous: CommonFormState,
    formData: FormData,
  ) => Promise<CommonFormState>;
  id: string;
}) {
  const [state, formAction] = useActionState<CommonFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        onClick={(event) => {
          if (!window.confirm("Annuler ce défi commun ?")) {
            event.preventDefault();
          }
        }}
      >
        Annuler
      </Button>
      {state.message && (
        <span role="alert" className="text-danger ml-2 text-sm">
          {state.message}
        </span>
      )}
    </form>
  );
}
