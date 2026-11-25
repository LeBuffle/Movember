import type { TextareaHTMLAttributes } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

/** Labelled multi-line field. Same contract as `Input`. */
export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  rows = 4,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-ink text-sm font-medium">
        {label}
      </label>

      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          cn(hint && hintId, error && errorId).trim() || undefined
        }
        className={cn(
          "bg-surface text-ink rounded-lg border px-3 py-2 text-base",
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
