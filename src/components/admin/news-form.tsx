"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import type { NewsFormState } from "@/lib/news/actions";

/**
 * Writing a message, from a phone.
 *
 * That is the constraint the whole screen follows: the animation of November
 * will happen in a train, between two meetings. Hence a short form, an
 * ordinary file field, and a preview that shows exactly what the feed will
 * render — no formatting, line breaks kept.
 *
 * **Saving does not publish, and publishing does not notify.** Three separate
 * gestures, on purpose: a message written on a platform should not go out
 * before it has been reread, and it should not interrupt eight hundred people
 * unless somebody decides it should (story 7.8 AC 7).
 */

export type NewsFormValues = {
  id: string;
  title: string;
  body: string;
  imagePath: string;
  isPinned: boolean;
  published: boolean;
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending
        ? "Enregistrement…"
        : editing
          ? "Enregistrer les modifications"
          : "Enregistrer le brouillon"}
    </Button>
  );
}

export function NewsForm({
  action,
  post,
}: {
  action: (
    previous: NewsFormState,
    formData: FormData,
  ) => Promise<NewsFormState>;
  post?: NewsFormValues;
}) {
  const [state, formAction] = useActionState<NewsFormState, FormData>(
    action,
    {},
  );

  const fileId = useId();
  const pinId = useId();

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [preview, setPreview] = useState<string | null>(null);

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {post?.id && <input type="hidden" name="id" value={post.id} />}

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {post?.published && (
        <Alert tone="info" title="Ce message est publié">
          Vos modifications seront visibles immédiatement par les participants.
        </Alert>
      )}

      <Input
        name="title"
        label="Titre"
        hint="Ce que les participants lisent en premier."
        value={title}
        error={fieldErrors.title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={120}
      />

      <Textarea
        name="body"
        label="Message"
        hint="Vos retours à la ligne sont conservés. Aucune mise en forme."
        value={body}
        error={fieldErrors.body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={4000}
        rows={6}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className="text-ink text-sm font-medium">
          Image (facultatif)
        </label>

        <input
          id={fileId}
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          className={cn(
            "text-ink file:bg-surface-sunken file:text-ink min-h-11 rounded-lg border px-3 py-2 text-base",
            "file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium",
            fieldErrors.image ? "border-danger" : "border-line",
          )}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />

        {fieldErrors.image ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {fieldErrors.image}
          </p>
        ) : (
          <p className="text-ink-muted text-sm">
            JPEG, PNG ou WebP, 8 Mo maximum. Une photo prise au téléphone
            convient — pensez à la réduire si elle est refusée.
          </p>
        )}
      </div>

      <div className="border-line bg-surface flex items-start gap-3 rounded-xl border p-3">
        <input
          id={pinId}
          type="checkbox"
          name="isPinned"
          defaultChecked={post?.isPinned ?? false}
          className="accent-brand-blue mt-1 size-5 shrink-0"
        />
        <label htmlFor={pinId} className="flex-1">
          <span className="text-ink block font-medium">
            Épingler en haut du fil
          </span>
          <span className="text-ink-muted block text-sm">
            Pour ce que tout le monde doit lire : la règle d’un défi commun, un
            changement de date. À réserver, sinon plus rien ne ressort.
          </span>
        </label>
      </div>

      {/* The preview renders exactly what the feed renders — same absence of
          formatting, same kept line breaks. Anything else would be a promise
          the feed does not keep. */}
      <section className="border-line bg-surface-sunken space-y-2 rounded-xl border p-4">
        <p className="text-ink-muted text-sm font-medium">Aperçu</p>

        <div className="border-line bg-surface overflow-hidden rounded-lg border">
          {(preview ?? post?.imagePath) && (
            /* eslint-disable-next-line @next/next/no-img-element --
               A blob URL for the file just chosen, or the stored picture.
               Neither goes through the optimiser. */
            <img
              src={preview ?? post?.imagePath}
              alt=""
              className="max-h-56 w-full object-cover"
            />
          )}

          <div className="space-y-1 p-3">
            <p className="text-ink font-bold">{title || "Titre du message"}</p>
            {body && (
              <p className="text-ink-muted text-sm whitespace-pre-line">
                {body}
              </p>
            )}
          </div>
        </div>
      </section>

      <SubmitButton editing={Boolean(post?.id)} />

      <p className="text-ink-muted text-sm">
        Enregistrer ne publie pas, et publier n’envoie aucune notification. Pour
        prévenir les participants, utilisez l’écran des notifications.
      </p>
    </form>
  );
}
