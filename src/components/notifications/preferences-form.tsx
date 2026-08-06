"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  ESSENTIAL_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications/payload";
import type { PreferencesState } from "@/lib/notifications/preference-actions";
import type { Preferences } from "@/lib/notifications/preferences";

/**
 * Choosing what to be told about.
 *
 * **Five categories rather than one switch, and that is the point of the
 * story.** Somebody annoyed by one kind of message will otherwise switch off
 * everything — including the daily challenge, which is the one message the
 * whole game depends on. Being able to cut precisely is what stops a small
 * annoyance from costing a participant.
 *
 * Ordinary checkboxes in an ordinary form pointing at a server action: it
 * works before the script arrives, and keeps working if it never does. There
 * is no auto-save on toggle — a preference that saves itself while you are
 * still deciding is a preference you cannot try out.
 */

const CATEGORY_HINTS: Record<NotificationCategory, string> = {
  defi_du_jour: "Chaque matin, le défi qui vous est attribué.",
  resultat: "Quand une de vos sorties valide un défi.",
  carte: "Quand une carte vous revient.",
  annonce: "Les messages de l’organisation pendant le mois.",
  relance: "Un rappel si vous n’avez rien joué depuis plusieurs jours.",
};

const ORDER: NotificationCategory[] = [
  "defi_du_jour",
  "resultat",
  "carte",
  "annonce",
  "relance",
];

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer mes préférences"}
    </Button>
  );
}

export function PreferencesForm({
  action,
  preferences,
}: {
  action: (
    previous: PreferencesState,
    formData: FormData,
  ) => Promise<PreferencesState>;
  preferences: Preferences;
}) {
  const [state, formAction] = useActionState<PreferencesState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {state.saved && (
        <Alert tone="success" title="Préférences enregistrées">
          Elles s’appliquent au prochain envoi.
        </Alert>
      )}

      <fieldset className="space-y-3">
        <legend className="text-ink font-semibold">Par quel moyen</legend>

        <Toggle
          name="channel_push"
          label="Notifications sur mon téléphone"
          hint="Immédiates. Demandent d’avoir autorisé les notifications ci-dessus."
          defaultChecked={preferences.channelPush}
        />

        <Toggle
          name="channel_email"
          label="E-mails"
          hint="Uniquement l’essentiel : défi du jour, annonces, relances."
          defaultChecked={preferences.channelEmail}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-ink font-semibold">De quoi</legend>

        {ORDER.map((category) => (
          <Toggle
            key={category}
            name={category}
            label={CATEGORY_LABELS[category]}
            hint={
              ESSENTIAL_CATEGORIES.includes(category)
                ? CATEGORY_HINTS[category]
                : `${CATEGORY_HINTS[category]} Dans l’application uniquement, jamais par e-mail.`
            }
            defaultChecked={preferences.categories[category]}
          />
        ))}
      </fieldset>

      <SaveButton />
    </form>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  const id = useId();

  return (
    <div className="border-line bg-surface rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="accent-brand-blue mt-1 size-5 shrink-0"
        />
        <label htmlFor={id} className="flex-1">
          <span className="text-ink block font-medium">{label}</span>
          <span className="text-ink-muted block text-sm">{hint}</span>
        </label>
      </div>
    </div>
  );
}
