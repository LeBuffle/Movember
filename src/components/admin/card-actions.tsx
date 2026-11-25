"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { CardFormState } from "@/lib/cards/admin-actions";

/**
 * The two irreversible-ish gestures of the card back-office.
 *
 * Both are buttons that say what they do, with a confirmation on the way out
 * — never switches. A stray thumb on this screen either puts an unfinished
 * card into circulation or removes one; one extra tap is a fair price.
 */

type CardAction = (
  previous: CardFormState,
  formData: FormData,
) => Promise<CardFormState>;

function PublishButton({ published }: { published: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={published ? "ghost" : "primary"}
      size="sm"
      disabled={pending}
      onClick={(event) => {
        if (
          published &&
          !window.confirm(
            "Dépublier cette carte ? Elle ne sera plus tirée. Les participants qui la possèdent déjà la gardent.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "…" : published ? "Dépublier" : "Publier"}
    </Button>
  );
}

export function CardPublishToggle({
  action,
  id,
  published,
}: {
  action: CardAction;
  id: string;
  published: boolean;
}) {
  const [state, formAction] = useActionState<CardFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="published"
        value={published ? "false" : "true"}
      />

      <PublishButton published={published} />

      {state.message && (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

function DeleteButton() {
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
            "Supprimer définitivement cette carte ? Cette action ne peut pas être annulée.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "…" : "Supprimer la carte"}
    </Button>
  );
}

/**
 * Deletion, offered only where it is actually possible.
 *
 * The caller decides whether to render this at all — a published card never
 * shows it. The write and a database trigger refuse anyway (story 5.6 AC 4),
 * but a button that only ever produces a refusal is a button that teaches
 * people to ignore refusals.
 */
export function CardDelete({ action, id }: { action: CardAction; id: string }) {
  const [state, formAction] = useActionState<CardFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />

      <DeleteButton />

      {state.message && (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
