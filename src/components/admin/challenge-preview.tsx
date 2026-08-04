"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { parseChallengeConfig } from "@/lib/challenges/config";
import { describeChallenge } from "@/lib/challenges/describe";
import type { ConditionValues, ConfigValues } from "@/lib/challenges/form";
import { buildConfig } from "@/lib/challenges/form";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/challenges/sports";

/**
 * What the participant will see, updated as the form is filled.
 *
 * **This is the check that catches the mistake bounds cannot.** Story 4.1
 * refuses a threshold that is absurdly large; nothing can refuse one that is
 * merely too small, because 5 metres is a perfectly valid number. What
 * catches it is reading "Parcourir 5 m" and seeing that it is not what was
 * meant — which is why the sentence describes what the machine understood,
 * never what the author probably intended.
 *
 * When the settings are not yet valid, it says so instead of showing a
 * half-sentence. A preview that guesses is worse than no preview: it would be
 * trusted.
 */
export function ChallengePreview({
  evaluator,
  title,
  description,
  points,
  difficulty,
  values,
  conditions,
}: {
  evaluator: string;
  title: string;
  description: string;
  points: string;
  difficulty: string;
  values: ConfigValues;
  conditions: ConditionValues[];
}) {
  const checked = parseChallengeConfig(
    evaluator,
    buildConfig(evaluator, values, conditions),
  );

  const lines = checked.ok
    ? describeChallenge(evaluator, checked.config)
    : null;

  const difficultyLabel =
    DIFFICULTY_LABELS[difficulty as Difficulty] ?? difficulty;

  return (
    <Card accent aria-live="polite">
      <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
        Ce que verra le participant
      </p>

      <h3 className="text-ink mt-2 text-xl font-bold">
        {title.trim() || "Titre du défi"}
      </h3>

      {description.trim() && (
        <p className="text-ink-muted mt-1">{description.trim()}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="orange">{points || "0"} points</Badge>
        {difficultyLabel && <Badge tone="neutral">{difficultyLabel}</Badge>}
      </div>

      <div className="border-line mt-4 border-t pt-4">
        {lines ? (
          <ul className="text-ink space-y-1">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted text-sm">
            Complétez les réglages ci-dessus : l’aperçu s’affichera dès qu’ils
            seront valides.
          </p>
        )}
      </div>
    </Card>
  );
}
