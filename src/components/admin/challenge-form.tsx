"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { ConfigFieldInput } from "@/components/admin/challenge-fields";
import { ChallengePreview } from "@/components/admin/challenge-preview";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChallengeFormState } from "@/lib/challenges/admin-actions";
import { evaluatorOptions } from "@/lib/challenges/config";
import {
  EVALUATORS,
  SURPRISE_CONDITION_KEYS,
  isEvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import {
  blankValues,
  valuesFromConfig,
  type ConditionValues,
  type ConfigValues,
} from "@/lib/challenges/form";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  SPORT_FAMILIES,
  SPORT_FAMILY_LABELS,
} from "@/lib/challenges/sports";

/**
 * Creating and editing a challenge, without writing a line of JSON.
 *
 * The criterion of epic 8 applies here in full: a volunteer with no technical
 * background must create a challenge **from their phone, unaided and without
 * documentation**. Everything below follows from that — the natural units,
 * the live preview, the settings that appear only when they apply.
 *
 * **The form does not know the seven evaluators.** It asks the registry what
 * to display and renders four kinds of setting. Adding an eighth mechanic in
 * story 4.7 must not require reopening this file, and nothing here does.
 */

const EVALUATOR_CHOICES = evaluatorOptions().map(({ key, label }) => ({
  value: key,
  label,
}));

const CONDITION_CHOICES = SURPRISE_CONDITION_KEYS.map((key) => ({
  value: key,
  label: EVALUATORS[key].label,
}));

const SPORT_CHOICES = SPORT_FAMILIES.map((family) => ({
  value: family,
  label: SPORT_FAMILY_LABELS[family],
}));

const DIFFICULTY_CHOICES = DIFFICULTIES.map((level) => ({
  value: level,
  label: DIFFICULTY_LABELS[level],
}));

export type ChallengeFormValues = {
  id: string;
  title: string;
  description: string;
  evaluator: string;
  config: Record<string, unknown>;
  sport_family: string;
  difficulty: string;
  points: string;
  duration_scope: string;
  duration_days: string;
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending
        ? "Enregistrement…"
        : editing
          ? "Enregistrer les modifications"
          : "Créer le défi"}
    </Button>
  );
}

export function ChallengeForm({
  action,
  challenge,
}: {
  action: (
    previous: ChallengeFormState,
    formData: FormData,
  ) => Promise<ChallengeFormState>;
  challenge?: ChallengeFormValues;
}) {
  const [state, formAction] = useActionState<ChallengeFormState, FormData>(
    action,
    {},
  );

  const initial = valuesFromConfig(
    challenge?.evaluator ?? "distance",
    challenge?.config ?? {},
  );

  const [title, setTitle] = useState(challenge?.title ?? "");
  const [description, setDescription] = useState(challenge?.description ?? "");
  const [evaluator, setEvaluator] = useState(
    challenge?.evaluator ?? "distance",
  );
  const [sportFamily, setSportFamily] = useState(
    challenge?.sport_family ?? "any",
  );
  const [difficulty, setDifficulty] = useState(
    challenge?.difficulty ?? "moyen",
  );
  const [points, setPoints] = useState(challenge?.points ?? "10");
  const [scope, setScope] = useState(challenge?.duration_scope ?? "day");
  const [days, setDays] = useState(challenge?.duration_days ?? "");
  const [values, setValues] = useState<ConfigValues>(initial.values);
  const [conditions, setConditions] = useState<ConditionValues[]>(
    initial.conditions,
  );

  const fieldErrors = state.fieldErrors ?? {};
  const definition = isEvaluatorKey(evaluator) ? EVALUATORS[evaluator] : null;

  // Changing the type empties the settings rather than carrying them over.
  // "5" left behind in a field that now counts days would be a valid
  // challenge, and the wrong one.
  const changeEvaluator = (next: string) => {
    const blank = blankValues(next);
    setEvaluator(next);
    setValues(blank.values);
    setConditions(blank.conditions);
  };

  const setValue = (name: string, value: string | string[]) =>
    setValues((current) => ({ ...current, [name]: value }));

  const setConditionValue = (
    index: number,
    name: string,
    value: string | string[],
  ) =>
    setConditions((current) =>
      current.map((condition, rank) =>
        rank === index
          ? { ...condition, values: { ...condition.values, [name]: value } }
          : condition,
      ),
    );

  return (
    <form action={formAction} className="space-y-8">
      {challenge?.id && <input type="hidden" name="id" value={challenge.id} />}

      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <section className="space-y-4">
        <h2 className="text-ink text-lg font-bold">Le défi</h2>

        <Input
          name="title"
          label="Titre"
          hint="Ce que le participant lira en premier. Exemple : « 5 km avant le café »."
          value={title}
          error={fieldErrors.title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
        />

        <Textarea
          name="description"
          label="Description (facultatif)"
          hint="Une phrase d’encouragement, une précision, un clin d’œil."
          value={description}
          error={fieldErrors.description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            name="sport_family"
            label="Famille de sport"
            hint="Sert à équilibrer le tirage, pas à juger la réussite."
            options={SPORT_CHOICES}
            value={sportFamily}
            error={fieldErrors.sport_family}
            onChange={(event) => setSportFamily(event.target.value)}
          />

          <Select
            name="difficulty"
            label="Difficulté"
            options={DIFFICULTY_CHOICES}
            value={difficulty}
            error={fieldErrors.difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          />

          <Input
            name="points"
            label="Points"
            hint="Ce que le défi rapporte au classement. 10 par défaut."
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={points}
            error={fieldErrors.points}
            onChange={(event) => setPoints(event.target.value)}
          />

          <Select
            name="duration_scope"
            label="Portée"
            options={[
              { value: "day", label: "Une seule journée" },
              { value: "multi_day", label: "Plusieurs jours" },
            ]}
            value={scope}
            error={fieldErrors.duration_scope}
            onChange={(event) => setScope(event.target.value)}
          />

          {scope === "multi_day" && (
            <Input
              name="duration_days"
              label="Nombre de jours"
              hint="Sur combien de jours le défi court."
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={days}
              error={fieldErrors.duration_days}
              onChange={(event) => setDays(event.target.value)}
            />
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-ink text-lg font-bold">Comment il est jugé</h2>

        <Select
          name="evaluator"
          label="Type de défi"
          hint={definition?.description}
          options={EVALUATOR_CHOICES}
          value={evaluator}
          error={fieldErrors.evaluator}
          onChange={(event) => changeEvaluator(event.target.value)}
        />

        {state.configErrors && state.configErrors.length > 0 && (
          <Alert tone="danger" title="Les réglages ne sont pas valides">
            <ul className="list-disc space-y-1 pl-5">
              {state.configErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {definition?.fields.map((field) =>
          field.kind === "conditions" ? (
            <ConditionsRepeater
              key={field.name}
              label={field.label}
              hint={field.hint}
              conditions={conditions}
              onAdd={() =>
                setConditions((current) => [
                  ...current,
                  {
                    evaluator: "distance",
                    values: blankValues("distance").values,
                  },
                ])
              }
              onRemove={(index) =>
                setConditions((current) =>
                  current.filter((_, rank) => rank !== index),
                )
              }
              onChangeEvaluator={(index, next) =>
                setConditions((current) =>
                  current.map((condition, rank) =>
                    rank === index
                      ? { evaluator: next, values: blankValues(next).values }
                      : condition,
                  ),
                )
              }
              onChangeValue={setConditionValue}
            />
          ) : (
            <ConfigFieldInput
              key={field.name}
              field={field}
              prefix="config"
              values={values}
              onChange={setValue}
            />
          ),
        )}
      </section>

      <ChallengePreview
        evaluator={evaluator}
        title={title}
        description={description}
        points={points}
        difficulty={difficulty}
        values={values}
        conditions={conditions}
      />

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <SubmitButton editing={Boolean(challenge?.id)} />
        <Link
          href="/admin/defis"
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

/**
 * The two-to-four conditions of a surprise challenge.
 *
 * Each row is an ordinary challenge type with its own settings, rendered by
 * the same component as everything else. That is what keeps AC 2 true for
 * the seventh evaluator too: combining conditions is picking from lists, not
 * writing a structure by hand.
 */
function ConditionsRepeater({
  label,
  hint,
  conditions,
  onAdd,
  onRemove,
  onChangeEvaluator,
  onChangeValue,
}: {
  label: string;
  hint?: string;
  conditions: ConditionValues[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChangeEvaluator: (index: number, evaluator: string) => void;
  onChangeValue: (
    index: number,
    name: string,
    value: string | string[],
  ) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-ink text-sm font-medium">{label}</legend>
      {hint && <p className="text-ink-muted text-sm">{hint}</p>}

      {conditions.map((condition, index) => {
        const definition = isEvaluatorKey(condition.evaluator)
          ? EVALUATORS[condition.evaluator]
          : null;

        return (
          <div
            key={index}
            className="border-line bg-surface-sunken space-y-4 rounded-xl border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink font-semibold">
                Condition {index + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                aria-label={`Retirer la condition ${index + 1}`}
              >
                Retirer
              </Button>
            </div>

            <Select
              name={`condition.${index}.evaluator`}
              label="Type"
              options={CONDITION_CHOICES}
              value={condition.evaluator}
              onChange={(event) => onChangeEvaluator(index, event.target.value)}
            />

            {definition?.fields.map((field) => (
              <ConfigFieldInput
                key={field.name}
                field={field}
                prefix={`condition.${index}`}
                values={condition.values}
                onChange={(name, value) => onChangeValue(index, name, value)}
              />
            ))}
          </div>
        );
      })}

      {conditions.length < 4 && (
        <Button variant="secondary" size="sm" onClick={onAdd}>
          Ajouter une condition
        </Button>
      )}
    </fieldset>
  );
}
