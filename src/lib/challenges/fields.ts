/**
 * How a challenge's settings are asked of a volunteer.
 *
 * Story 4.1 gave each evaluator a schema; a schema says what is *valid*, not
 * what to *show*. These descriptors are the missing half, and they live next
 * to the schemas in the registry so that adding an evaluator means adding one
 * entry and nothing else — the form of story 4.2 builds itself from them.
 *
 * **The unit shown is the natural one, never the stored one.** This is the
 * whole point of the file. A field labelled "distance en mètres" invites
 * someone to type 5 meaning kilometres — the single most likely mistake in
 * the catalogue, and one that produces a challenge nobody can fail. So the
 * volunteer types kilometres and minutes, the numbers they would say out
 * loud, and the conversion happens here. Nobody is ever asked to multiply by
 * a thousand in their head.
 */

export type Unit = { unit: string; factor: number };

export type NumberField = {
  kind: "number";
  /** Key in the stored configuration. */
  name: string;
  label: string;
  /** Unit the volunteer types in. */
  unit: string;
  /** Multiplier from the typed unit to the stored one. */
  factor: number;
  hint?: string;
  optional?: boolean;
  /**
   * When the unit depends on another setting.
   *
   * A collective target counts kilometres, hours or activities depending on
   * what was chosen just above it. Rather than label it "objectif (dans
   * l'unité choisie)" — which is how someone ends up typing hours into a
   * field counting seconds — the form follows the sibling field.
   */
  unitBy?: {
    field: string;
    units: Record<string, Unit>;
  };
};

export type SportsField = {
  kind: "sports";
  name: string;
  label: string;
  hint?: string;
};

export type ChoiceField = {
  kind: "choice";
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: string;
};

/** The surprise evaluator's list of combined conditions. Rendered as a repeater. */
export type ConditionsField = {
  kind: "conditions";
  name: string;
  label: string;
  hint?: string;
};

export type ConfigField =
  NumberField | SportsField | ChoiceField | ConditionsField;

/**
 * Reads a number typed by a human.
 *
 * Accepts the comma as a decimal separator: a French phone keyboard offers a
 * comma, and refusing "5,5" would be refusing the obvious.
 *
 * @returns `null` for anything that is not a number, including an empty
 * field. The caller leaves the key out of the configuration entirely so the
 * schema reports it as missing — which reads as "ce réglage est obligatoire"
 * rather than as a type error.
 */
export function parseNumberInput(raw: unknown): number | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * The unit actually in force, given what the rest of the form says.
 *
 * `siblings` is what has been filled so far — the raw values, since the form
 * calls this while the volunteer is still typing.
 */
export function resolveUnit(
  field: NumberField,
  siblings: Record<string, unknown> = {},
): Unit {
  if (!field.unitBy) return { unit: field.unit, factor: field.factor };

  const chosen = siblings[field.unitBy.field];
  const match =
    typeof chosen === "string" ? field.unitBy.units[chosen] : undefined;

  return match ?? { unit: field.unit, factor: field.factor };
}

/**
 * Converts what was typed into what is stored.
 *
 * Rounds, because every stored quantity is an integer: 5,5 km is 5500 m, and
 * 0,7 km is 700 m rather than 699.9999.
 */
export function fieldToStored(
  field: NumberField,
  raw: unknown,
  siblings: Record<string, unknown> = {},
): number | null {
  const value = parseNumberInput(raw);
  if (value === null) return null;

  return Math.round(value * resolveUnit(field, siblings).factor);
}

/** The reverse, for filling the form when editing an existing challenge. */
export function fieldToDisplay(
  field: NumberField,
  stored: unknown,
  siblings: Record<string, unknown> = {},
): string {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return "";

  const value = stored / resolveUnit(field, siblings).factor;

  // Trailing zeroes read as a machine talking: "5" rather than "5.0".
  return String(Number(value.toFixed(3)));
}
