"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AUDIENCES } from "@/lib/notifications/audience";
import type { BroadcastState } from "@/lib/notifications/broadcast-actions";
import { MAX_BODY, MAX_TITLE } from "@/lib/notifications/payload";

/**
 * Writing a message to the participants.
 *
 * **The count of recipients is the real safeguard, and it is on screen before
 * the button.** A notification that has gone has gone; a confirmation
 * dialogue somebody clicks through is worth far less than a number they read
 * a second earlier.
 *
 * The message carries an identifier generated when the page was rendered. A
 * double press, a back button, a refresh — all reuse it, and the send is
 * refused the second time rather than duplicated. Nothing here has to
 * remember that: it is a hidden field.
 */

function SendButton({ recipients }: { recipients: number }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending || recipients === 0}
      onClick={(event) => {
        if (
          !window.confirm(
            `Envoyer ce message à ${recipients} participant${recipients > 1 ? "s" : ""} ? Une notification envoyée ne peut pas être annulée.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending
        ? "Envoi en cours…"
        : `Envoyer à ${recipients} participant${recipients > 1 ? "s" : ""}`}
    </Button>
  );
}

export function BroadcastForm({
  action,
  messageId,
  counts,
}: {
  action: (
    previous: BroadcastState,
    formData: FormData,
  ) => Promise<BroadcastState>;
  /** Generated server-side at render. What makes a double send harmless. */
  messageId: string;
  counts: Record<string, number>;
}) {
  const [state, formAction] = useActionState<BroadcastState, FormData>(
    action,
    {},
  );

  const [audience, setAudience] = useState(AUDIENCES[0]!.value);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const fieldErrors = state.fieldErrors ?? {};
  const recipients = counts[audience] ?? 0;
  const chosen = AUDIENCES.find((entry) => entry.value === audience);

  if (state.report) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Message envoyé">
          <ul className="mt-2 space-y-1">
            <li>{state.report.sent} notification(s) sur téléphone</li>
            <li>{state.report.emailed} e-mail(s)</li>
            <li>
              {state.report.skipped} sans envoi (préférence, ou appareil absent)
            </li>
            {state.report.failed > 0 && (
              <li className="text-danger">{state.report.failed} en échec</li>
            )}
          </ul>
        </Alert>

        <p className="text-ink-muted text-sm">
          Rechargez la page pour écrire un autre message. Renvoyer celui-ci
          n’enverrait rien : il est déjà parti.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="messageId" value={messageId} />

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Select
        name="audience"
        label="À qui"
        hint={chosen?.hint}
        options={AUDIENCES.map((entry) => ({
          value: entry.value,
          label: `${entry.label} — ${counts[entry.value] ?? 0}`,
        }))}
        value={audience}
        error={fieldErrors.audience}
        onChange={(event) =>
          setAudience(event.target.value as (typeof AUDIENCES)[number]["value"])
        }
      />

      <Input
        name="title"
        label="Titre"
        hint="Ce qui s’affiche en gras sur l’écran verrouillé. Court."
        value={title}
        error={fieldErrors.title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={MAX_TITLE}
      />

      <Textarea
        name="body"
        label="Message (facultatif)"
        hint={`Une ou deux phrases. ${MAX_BODY} caractères maximum.`}
        value={body}
        error={fieldErrors.body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={MAX_BODY}
        rows={3}
      />

      <Input
        name="url"
        label="Où mène la notification (facultatif)"
        hint="Un chemin de l’application, par exemple /jeu/collection. Par défaut, l’écran du jeu."
        placeholder="/jeu"
      />

      {/* The preview. What the participant will see, not what was typed —
          which is the same thing here, and that is the point of showing it. */}
      <section className="border-line bg-surface-sunken rounded-xl border p-4">
        <p className="text-ink-muted text-sm font-medium">Aperçu</p>
        <div className="border-line bg-surface mt-2 rounded-lg border p-3">
          <p className="text-ink font-semibold">
            {title || "Titre du message"}
          </p>
          {body && <p className="text-ink-muted mt-1 text-sm">{body}</p>}
        </div>
      </section>

      <Alert
        tone="warning"
        title={`${recipients} destinataire${recipients > 1 ? "s" : ""}`}
      >
        Une notification envoyée ne peut pas être annulée. Vérifiez le nombre
        ci-dessus avant d’envoyer.
      </Alert>

      <SendButton recipients={recipients} />
    </form>
  );
}
