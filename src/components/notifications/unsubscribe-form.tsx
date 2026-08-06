"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { UnsubscribeState } from "@/lib/notifications/unsubscribe-actions";

/**
 * The confirmation, in one press.
 *
 * A press rather than an automatic unsubscribe on page load, because mail
 * clients and security scanners follow links in messages without anybody
 * having read them — an unsubscribe that fires on load would quietly cut off
 * participants who never touched it.
 *
 * An ordinary form pointing at a server action, so it works before the script
 * arrives. That matters more here than anywhere else: this page is opened
 * from an e-mail client's in-app browser, which is the least predictable
 * environment the application ever runs in.
 */
function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "…" : "Confirmer, ne plus recevoir d’e-mails"}
    </Button>
  );
}

export function UnsubscribeForm({
  action,
  token,
}: {
  action: (
    previous: UnsubscribeState,
    formData: FormData,
  ) => Promise<UnsubscribeState>;
  token: string;
}) {
  const [state, formAction] = useActionState<UnsubscribeState, FormData>(
    action,
    {},
  );

  if (state.done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="C’est fait">
          Vous ne recevrez plus d’e-mails du jeu. Vos notifications sur
          téléphone, si vous en avez activé, continuent normalement.
        </Alert>

        <p className="text-ink-muted text-sm">
          Vous pouvez revenir sur ce choix à tout moment depuis{" "}
          <Link
            href="/mon-compte/notifications"
            className="underline underline-offset-4"
          >
            « Mes notifications »
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="jeton" value={token} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <ConfirmButton />
    </form>
  );
}
