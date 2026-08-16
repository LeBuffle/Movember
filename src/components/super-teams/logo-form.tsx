"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { TeamLogo } from "@/components/super-teams/team-logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import type { AppearanceState } from "@/lib/super-teams/appearance-actions";

type Action = (
  previous: AppearanceState,
  formData: FormData,
) => Promise<AppearanceState>;

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

const FILE_CLASSES = cn(
  "text-ink file:bg-surface-sunken file:text-ink min-h-11 rounded-lg border px-3 py-2 text-base",
  "file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium",
  "border-line",
);

const FILE_HINT =
  "JPEG, PNG ou WebP, 2 Mo maximum. Carré de préférence — l’image est affichée telle quelle, sans recadrage.";

/**
 * The captain putting their club's badge on their team (story 14.4).
 *
 * A preview before sending, because the picture is shown as it comes: a
 * rectangular banner squeezed into a square is obvious here and invisible in
 * a file picker.
 */
export function TeamLogoForm({
  set,
  clear,
  teamName,
  logoUrl,
}: {
  set: Action;
  clear: Action;
  teamName: string;
  logoUrl: string | null;
}) {
  const [state, formAction] = useActionState<AppearanceState, FormData>(
    set,
    {},
  );
  const [clearState, clearAction] = useActionState<AppearanceState, FormData>(
    clear,
    {},
  );
  const [preview, setPreview] = useState<string | null>(null);
  const fileId = useId();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <TeamLogo name={teamName} url={preview ?? logoUrl} size="lg" />

        <p className="text-ink-muted text-sm">
          {logoUrl
            ? "Le logo de votre équipe, visible sur sa page et dans les classements."
            : "Sans logo, votre équipe affiche ses initiales."}
        </p>
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.done && state.message && (
        <Alert tone="success">{state.message}</Alert>
      )}
      {clearState.error && <Alert tone="danger">{clearState.error}</Alert>}

      <form action={formAction} className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileId} className="text-ink text-sm font-medium">
            {logoUrl ? "Remplacer le logo" : "Envoyer un logo"}
          </label>

          <input
            id={fileId}
            type="file"
            name="logo"
            accept="image/jpeg,image/png,image/webp"
            className={FILE_CLASSES}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />

          <p className="text-ink-muted text-sm">{FILE_HINT}</p>
        </div>

        <SubmitButton idle="Envoyer" busy="Envoi…" />
      </form>

      {logoUrl && (
        <form action={clearAction}>
          <Button type="submit" variant="ghost" size="sm">
            Retirer le logo
          </Button>
        </form>
      )}

      <p className="text-ink-muted text-sm">
        L’organisation peut retirer un logo qui ne conviendrait pas. Vous en
        seriez prévenu et pourriez en envoyer un autre.
      </p>
    </div>
  );
}

/**
 * The super team captain's screen (story 14.5).
 *
 * **Two fields, and that is the whole of it.** The name, the composition and
 * the captaincy are the organisation's — appearance comes undone in one
 * click, a detachment does not.
 */
export function SuperTeamAppearanceForm({
  action,
  name,
  description,
  logoUrl,
}: {
  action: Action;
  name: string;
  description: string;
  logoUrl: string | null;
}) {
  const [state, formAction] = useActionState<AppearanceState, FormData>(
    action,
    {},
  );
  const [text, setText] = useState(description);
  const [preview, setPreview] = useState<string | null>(null);
  const fileId = useId();
  const removeId = useId();

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.done && state.message && (
        <Alert tone="success">{state.message}</Alert>
      )}

      <div className="flex items-center gap-4">
        <TeamLogo name={name} url={preview ?? logoUrl} size="lg" />

        <p className="text-ink-muted text-sm">
          {logoUrl
            ? "Le logo de la fédération, visible sur sa page."
            : "Sans logo, la fédération affiche ses initiales."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className="text-ink text-sm font-medium">
          {logoUrl ? "Remplacer le logo" : "Envoyer un logo"}
        </label>

        <input
          id={fileId}
          type="file"
          name="logo"
          accept="image/jpeg,image/png,image/webp"
          className={FILE_CLASSES}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />

        <p className="text-ink-muted text-sm">{FILE_HINT}</p>
      </div>

      {logoUrl && (
        <label
          htmlFor={removeId}
          className="text-ink flex items-center gap-2 text-sm"
        >
          <input
            id={removeId}
            type="checkbox"
            name="removeLogo"
            className="size-4"
          />
          Retirer le logo actuel
        </label>
      )}

      <Textarea
        name="description"
        label="Description"
        hint="Quelques lignes de présentation, lues sur la page de la fédération."
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={1000}
        rows={5}
      />

      <SubmitButton idle="Enregistrer" busy="Enregistrement…" />
    </form>
  );
}
