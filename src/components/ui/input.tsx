import type { InputHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Labelled text input.
 *
 * The label is required rather than optional: an unlabelled field is
 * unusable with a screen reader, and placeholder-as-label disappears as soon
 * as the participant starts typing.
 */
export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-ink text-sm font-medium">
        {label}
      </label>

      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          cn(hint && hintId, error && errorId).trim() || undefined
        }
        className={cn(
          "bg-surface text-ink min-h-11 rounded-lg border px-3 text-base",
          "placeholder:text-ink-muted",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      />

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
