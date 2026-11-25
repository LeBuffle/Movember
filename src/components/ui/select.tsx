import type { SelectHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** First entry, shown when nothing is chosen yet. */
  placeholder?: string;
};

/**
 * Labelled dropdown.
 *
 * A native `<select>` rather than a custom widget: on a phone it opens the
 * system picker, which is bigger, scrollable with one thumb, and already
 * familiar. Nothing we could build would be easier to use in a corridor.
 */
export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-ink text-sm font-medium">
        {label}
      </label>

      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          cn(hint && hintId, error && errorId).trim() || undefined
        }
        className={cn(
          "bg-surface text-ink min-h-11 rounded-lg border px-3 text-base",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {hint && !error && (
        <p id={hintId} className="text-ink-muted text-sm">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
