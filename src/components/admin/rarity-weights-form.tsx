"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WeightsFormState } from "@/lib/cards/admin-actions";
import type { RarityLine } from "@/lib/cards/admin";
import type { Rarity } from "@/lib/cards/draw";

/**
 * The draw odds, as four numbers anybody can argue with.
 *
 * **Weights, shown as percentages.** What is stored is relative — 60/28/10/2
 * and 600/280/100/20 describe the same game — which is what lets one be
 * nudged without having to make the others add up again. But nobody thinks in
 * weights, so the share each one represents is computed live, next to the
 * box. Somebody raising the legendary from 2 to 5 sees the épique fall from
 * 9.5 % to 9.2 % as they type, and understands why.
 *
 * The count of published cards sits on the same line, because a rarity with a
 * weight and no card never comes out — and from here that is otherwise
 * invisible.
 */

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer les probabilités"}
    </Button>
  );
}

export function RarityWeightsForm({
  action,
  lines,
}: {
  action: (
    previous: WeightsFormState,
    formData: FormData,
  ) => Promise<WeightsFormState>;
  lines: RarityLine[];
}) {
  const [state, formAction] = useActionState<WeightsFormState, FormData>(
    action,
    {},
  );

  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((line) => [line.slug, String(line.weight)])),
  );

  const fieldErrors = state.fieldErrors ?? {};

  const total = lines.reduce((sum, line) => {
    const value = Number(weights[line.slug]);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {state.saved && (
        <Alert tone="success" title="Probabilités enregistrées">
          Elles s’appliquent au prochain défi validé. Aucun redéploiement n’est
          nécessaire.
        </Alert>
      )}

      <ul className="space-y-4">
        {lines.map((line) => (
          <li
            key={line.slug}
            className="border-line bg-surface rounded-xl border p-4"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem] sm:items-start">
              <div>
                <p className="text-ink font-semibold">{line.label}</p>

                <p className="text-ink-muted mt-1 text-sm">
                  {share(weights[line.slug], total)}
                </p>

                <p
                  className={
                    line.published === 0
                      ? "text-danger mt-1 text-sm"
                      : "text-ink-muted mt-1 text-sm"
                  }
                >
                  {line.published === 0
                    ? "Aucune carte publiée : cette rareté ne sortira jamais, quel que soit son poids."
                    : `${line.published} carte${line.published > 1 ? "s" : ""} publiée${line.published > 1 ? "s" : ""}.`}
                </p>
              </div>

              <Input
                name={line.slug}
                label="Poids"
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                value={weights[line.slug] ?? ""}
                error={fieldErrors[line.slug]}
                onChange={(event) =>
                  setWeights((current) => ({
                    ...current,
                    [line.slug as Rarity]: event.target.value,
                  }))
                }
              />
            </div>
          </li>
        ))}
      </ul>

      <SaveButton />
    </form>
  );
}

function share(value: string | undefined, total: number): string {
  const weight = Number(value);

  if (!Number.isFinite(weight) || weight <= 0) {
    return "Ne sort jamais.";
  }

  if (total <= 0) return "Ne sort jamais.";

  return `Environ ${((weight / total) * 100).toFixed(1)} % des tirages.`;
}
