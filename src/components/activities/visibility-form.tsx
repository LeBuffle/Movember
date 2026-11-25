"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { VisibilityState } from "@/lib/activities/visibility-actions";

/**
 * Le réglage de visibilité des sorties (story 15.2).
 *
 * **Le texte compte autant que l'interrupteur.** Sans la phrase qui énumère
 * ce qui est montré et ce qui ne l'est jamais, la seule façon de savoir ce
 * qu'on partage est d'aller regarder la page de quelqu'un d'autre — ce que
 * personne ne fait avant d'avoir un doute, c'est-à-dire trop tard.
 */
function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
    </Button>
  );
}

export function ActivitiesVisibilityForm({
  action,
  optedOut,
}: {
  action: (
    previous: VisibilityState,
    formData: FormData,
  ) => Promise<VisibilityState>;
  optedOut: boolean;
}) {
  const [state, formAction] = useActionState<VisibilityState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name="montrer"
          defaultChecked={!optedOut}
          className="mt-1"
        />
        <span className="text-ink text-sm">
          Montrer mes sorties aux autres participants.
          <span className="text-ink-muted mt-1 block">
            Depuis le classement, ils peuvent alors ouvrir mes dix dernières
            sorties de la catégorie :{" "}
            <strong>sport, date, distance, durée et dénivelé</strong>. Jamais le
            titre de la sortie, jamais son tracé. Mes sorties masquées sur
            Strava restent masquées ici.
          </span>
          <span className="text-ink-muted mt-1 block">
            Couper l’affichage ne change ni mon rang, ni mes points, ni mes
            défis.
          </span>
        </span>
      </label>

      <SaveButton />
    </form>
  );
}
