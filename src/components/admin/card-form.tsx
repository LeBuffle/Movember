"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CardFormState } from "@/lib/cards/admin-actions";
import { RARITY_CHOICES, RARITY_LABELS } from "@/lib/cards/form";
import { cn } from "@/lib/cn";

/**
 * Creating and editing a card, from a phone.
 *
 * The criterion of epic 8 applies here as it does to the challenge form: a
 * volunteer with no technical background must be able to add a card unaided
 * and without documentation. Hence the live preview — what is on the right is
 * exactly what will land in somebody's album — and hence the picture being
 * optional.
 *
 * **The picture is optional on purpose.** The visuals are a September job and
 * they will arrive one at a time; a form that refused to save without one
 * would mean the fifty titles could not be prepared in advance. A card with
 * no picture shows its initials on its rarity's tint, which is a placeholder
 * nobody mistakes for a design.
 */

export type CardFormValues = {
  id: string;
  title: string;
  description: string;
  rarity: string;
  imagePath: string;
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
          : "Créer la carte"}
    </Button>
  );
}

export function CardForm({
  action,
  card,
}: {
  action: (
    previous: CardFormState,
    formData: FormData,
  ) => Promise<CardFormState>;
  card?: CardFormValues;
}) {
  const [state, formAction] = useActionState<CardFormState, FormData>(
    action,
    {},
  );

  const fileId = useId();
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [rarity, setRarity] = useState(card?.rarity ?? "commune");
  const [preview, setPreview] = useState<string | null>(null);

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-8">
      {card?.id && <input type="hidden" name="id" value={card.id} />}

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {card?.published && (
        <Alert tone="info" title="Cette carte est publiée">
          Vos modifications seront visibles immédiatement, y compris pour les
          participants qui la possèdent déjà.
        </Alert>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_14rem] md:items-start">
        <section className="space-y-4">
          <Input
            name="title"
            label="Titre"
            hint="Le nom de la carte. Exemple : « Moustache du dimanche »."
            value={title}
            error={fieldErrors.title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
          />

          <Textarea
            name="description"
            label="Description (facultatif)"
            hint="Une ligne d’ambiance, lue quand la carte est ouverte."
            value={description}
            error={fieldErrors.description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
          />

          <Select
            name="rarity"
            label="Rareté"
            hint="Décide de la fréquence à laquelle elle sort, pas de sa valeur en points."
            options={RARITY_CHOICES}
            value={rarity}
            error={fieldErrors.rarity}
            onChange={(event) => setRarity(event.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor={fileId} className="text-ink text-sm font-medium">
              Visuel (facultatif)
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
                JPEG, PNG ou WebP, 8 Mo maximum. Format portrait, dans les
                proportions d’une carte à collectionner (environ 1040 × 1500).
                Sans visuel, la carte affiche ses initiales.
              </p>
            )}
          </div>
        </section>

        {/* The preview. Shown on the same screen as the fields rather than
            after saving: a title too long for the card is obvious here and
            invisible in a text box. */}
        <section aria-labelledby="apercu" className="space-y-2">
          <h2 id="apercu" className="text-ink text-sm font-medium">
            Aperçu
          </h2>

          <CardPreview
            title={title}
            rarity={rarity}
            image={preview ?? card?.imagePath ?? ""}
          />
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <SubmitButton editing={Boolean(card?.id)} />
        <Link
          href="/admin/cartes"
          className={buttonClasses({
            variant: "ghost",
            size: "lg",
            className: "w-full sm:w-auto",
          })}
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}

const PREVIEW_FILL: Record<string, string> = {
  commune: "bg-surface-sunken text-ink-muted",
  rare: "bg-brand-blue-soft text-brand-blue",
  epique: "bg-brand-orange-soft text-brand-orange-ink",
  legendaire: "bg-success-soft text-success",
};

function CardPreview({
  title,
  rarity,
  image,
}: {
  title: string;
  rarity: string;
  image: string;
}) {
  return (
    <figure className="border-line bg-surface overflow-hidden rounded-xl border">
      <div
        className={cn(
          "aspect-carte flex items-center justify-center",
          PREVIEW_FILL[rarity] ?? PREVIEW_FILL.commune,
        )}
      >
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             Either a blob URL for the file just chosen, or the stored
             picture. Neither goes through the optimiser, and this is one
             thumbnail on a back-office screen. */
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="text-3xl font-extrabold opacity-70">
            {initials(title)}
          </span>
        )}
      </div>

      <figcaption className="text-ink space-y-1 p-2 text-sm">
        <p className="truncate font-medium">{title || "Sans titre"}</p>
        <p className="text-ink-muted text-xs">
          {RARITY_LABELS[rarity as keyof typeof RARITY_LABELS] ?? rarity}
        </p>
      </figcaption>
    </figure>
  );
}

function initials(title: string): string {
  const letters = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return letters || "?";
}
