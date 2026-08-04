"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormState } from "@/lib/auth/actions";

/**
 * Field description rather than rendered fields.
 *
 * The pages that use this form are server components, and React refuses to
 * pass a function across that boundary — a render prop taking the current
 * errors cannot work. Describing the fields as plain data keeps them
 * serialisable while still letting this client component wire each one to
 * its error message.
 */
export type AuthField = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Un instant…" : label}
    </Button>
  );
}

/**
 * Shell shared by every authentication screen.
 *
 * Holds the parts that are easy to get subtly wrong on one page out of four:
 * where the error is announced, that it is announced at all, and that the
 * button cannot be pressed twice.
 */
export function AuthForm({
  title,
  intro,
  action,
  submitLabel,
  fields,
  hiddenFields,
  footer,
}: {
  title: string;
  intro?: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  fields: AuthField[];
  hiddenFields?: Record<string, string>;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const errors = state.errors ?? {};

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-ink text-3xl font-bold tracking-tight">{title}</h1>
      {intro && <p className="text-ink-muted mt-2">{intro}</p>}

      {/* Above the fields, not below: a message under the submit button is
          easily missed on a phone, where the keyboard hides it. */}
      {state.message && (
        <div className="mt-6">
          <Alert tone={state.success ? "success" : "danger"}>
            {state.message}
          </Alert>
        </div>
      )}

      {!state.success && (
        <form action={formAction} className="mt-6 space-y-5">
          {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          {fields.map((field) => (
            <Input
              key={field.name}
              label={field.label}
              name={field.name}
              type={field.type ?? "text"}
              autoComplete={field.autoComplete}
              required={field.required}
              hint={field.hint}
              defaultValue={field.defaultValue}
              error={errors[field.name]}
            />
          ))}

          <SubmitButton label={submitLabel} />
        </form>
      )}

      {footer && <div className="text-ink-muted mt-6 text-sm">{footer}</div>}
    </main>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="text-brand-blue underline underline-offset-4">
      {children}
    </Link>
  );
}
