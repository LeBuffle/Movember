import { z } from "zod";

/**
 * Form validation, shared by the server actions.
 *
 * All messages are in French: they are shown as-is to participants.
 */

/**
 * Public alias, shown in leaderboards instead of the civil name.
 *
 * Letters, digits, spaces, hyphens, underscores and apostrophes — enough for
 * "Jean-Pierre", "MoustacheDor" or "L'Ours", but no characters that could be
 * used to impersonate another participant visually or to inject markup.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Le pseudonyme doit contenir au moins 2 caractères.")
  .max(30, "Le pseudonyme ne peut pas dépasser 30 caractères.")
  .regex(
    /^[\p{L}\p{N} '’_-]+$/u,
    "Le pseudonyme ne peut contenir que des lettres, chiffres, espaces, tirets et apostrophes.",
  );

export const emailSchema = z
  .string()
  .trim()
  .min(1, "L’adresse e-mail est obligatoire.")
  .email("Cette adresse e-mail n’est pas valide.");

/**
 * Minimum length only, deliberately.
 *
 * Composition rules (one uppercase, one digit, one symbol) push people toward
 * predictable substitutions and written-down passwords without measurably
 * improving strength. Length is what matters, and Supabase checks the
 * password against known breach lists on its side.
 */
export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(72, "Le mot de passe ne peut pas dépasser 72 caractères.");

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
});

/** First error message per field, in the shape the forms expect. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    result[field] ??= issue.message;
  }

  return result;
}
