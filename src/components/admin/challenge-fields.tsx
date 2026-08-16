"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ConfigValues } from "@/lib/challenges/form";
import { resolveUnit, type ConfigField } from "@/lib/challenges/fields";
import { SPORT_FAMILIES, SPORT_FAMILY_LABELS } from "@/lib/challenges/sports";

/**
 * Renders one evaluator setting, whatever it is.
 *
 * Driven entirely by the registry's descriptors: this component knows about
 * four *kinds* of setting, never about a particular one. That is what makes
 * story 4.7 — the six remaining evaluators — a change to the registry and
 * nothing else, and it is the property story 4.2 was asked to protect.
 */

function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function ConfigFieldInput({
  field,
  prefix,
  values,
  onChange,
}: {
  field: ConfigField;
  /** `config` at the top level, `condition.0` inside a surprise challenge. */
  prefix: string;
  values: ConfigValues;
  onChange: (name: string, value: string | string[]) => void;
}) {
  const name = `${prefix}.${field.name}`;

  switch (field.kind) {
    case "number": {
      // The unit can depend on another answer — a collective target counts
      // kilometres, hours or activities. Following the sibling field beats
      // labelling it "dans l'unité choisie" and hoping.
      const { unit } = resolveUnit(field, values);

      return (
        <Input
          name={name}
          label={`${field.label}${field.optional ? " (facultatif)" : ""}`}
          hint={field.hint}
          // Text rather than a numeric input, with the numeric keypad asked
          // for separately. A French phone keyboard offers a comma, and
          // `type="number"` discards "5,5" in several browsers — the field
          // simply comes back empty, with nothing said. The value is parsed
          // here and validated again on the server, so nothing is lost by
          // letting the browser stay out of it.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          // The unit is repeated inside the field, not only in the hint: the
          // hint is the first thing that stops being read.
          placeholder={unit}
          value={
            typeof values[field.name] === "string" ? values[field.name] : ""
          }
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      );
    }

    case "choice":
      return (
        <Select
          name={name}
          label={field.label}
          hint={field.hint}
          options={field.options}
          value={
            typeof values[field.name] === "string"
              ? values[field.name]
              : field.options[0]?.value
          }
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      );

    case "sports": {
      const chosen = toArray(values[field.name]);

      return (
        <fieldset>
          <legend className="text-ink text-sm font-medium">
            {field.label}
          </legend>
          {field.hint && (
            <p className="text-ink-muted mt-1 text-sm">{field.hint}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {SPORT_FAMILIES.map((family) => {
              const active = chosen.includes(family);

              return (
                // The whole chip is the target. A 16-pixel checkbox is the
                // hardest control to hit on a phone, and this screen is meant
                // to be usable from one.
                <label
                  key={family}
                  className={[
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm",
                    active
                      ? "border-brand-blue bg-brand-blue-soft text-brand-blue font-medium"
                      : "border-line bg-surface text-ink-muted",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    name={name}
                    value={family}
                    checked={active}
                    onChange={(event) =>
                      onChange(
                        field.name,
                        event.target.checked
                          ? [...chosen, family]
                          : chosen.filter((value) => value !== family),
                      )
                    }
                    className="accent-brand-blue h-4 w-4"
                  />
                  {SPORT_FAMILY_LABELS[family]}
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }

    case "conditions":
      // Handled by the form itself: a repeater needs to add and remove rows,
      // which is a different shape of state than a single value.
      return null;
  }
}
