"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { describeActivity } from "@/lib/activities/activity";
import { simulatedActivitiesForDay } from "@/lib/activities/simulated";
import { parseChallengeConfig } from "@/lib/challenges/config";
import { evaluate } from "@/lib/challenges/evaluators/evaluate";
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

      {checked.ok && (
        <Rehearsal evaluator={evaluator} config={checked.config} />
      )}
    </Card>
  );
}

/**
 * The challenge tried against a handful of ordinary activities.
 *
 * Reading a rule and knowing who it lets through are two different things.
 * "Parcourir 5 km" looks unambiguous until one notices it turns down the
 * 4 999 m run and the 3 km walk — which is correct, and worth seeing before
 * four hundred people find out on a November morning.
 *
 * Runs the **real** evaluator, not a description of it. A rehearsal that used
 * its own logic would eventually disagree with the engine, and the day it did
 * would be the day it mattered.
 */
function Rehearsal({
  evaluator,
  config,
}: {
  evaluator: string;
  config: Record<string, unknown>;
}) {
  // A fixed day in the edition rather than today's date: the same challenge
  // must rehearse the same way on any screen, on any day.
  const day = "2026-11-15";

  const results = simulatedActivitiesForDay(day).map((activity) => ({
    activity,
    verdict: evaluate(evaluator, {
      activity,
      config,
      context: { assignedFor: day, durationDays: 1 },
    }),
  }));

  const unsupported = results.some(
    (result) => !result.verdict.completed && "unsupported" in result.verdict,
  );

  if (unsupported) {
    return (
      <div className="border-line mt-4 border-t pt-4">
        <p className="text-ink-muted text-sm">
          Ce type de défi n’est pas encore évalué automatiquement — l’essai
          arrivera avec le reste des évaluateurs.
        </p>
      </div>
    );
  }

  const passing = results.filter((result) => result.verdict.completed);

  return (
    <div className="border-line mt-4 border-t pt-4">
      <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
        À l’essai, sur une journée ordinaire
      </p>

      {passing.length === 0 ? (
        <p className="text-danger mt-2 text-sm">
          Aucune activité courante ne validerait ce défi. Il est peut-être trop
          exigeant — ou réglé dans la mauvaise unité.
        </p>
      ) : (
        <p className="text-ink-muted mt-2 text-sm">
          {passing.length} activité{passing.length > 1 ? "s" : ""} sur{" "}
          {results.length} le validerait{passing.length > 1 ? "ent" : ""}.
        </p>
      )}

      <ul className="mt-2 space-y-1 text-sm">
        {results.map(({ activity, verdict }) => (
          <li key={activity.id} className="flex flex-wrap items-baseline gap-2">
            <span
              className={verdict.completed ? "text-success" : "text-ink-muted"}
            >
              {verdict.completed ? "✓" : "·"}
            </span>
            <span className="text-ink">{describeActivity(activity)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
