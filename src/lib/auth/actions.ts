"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authErrorMessage } from "@/lib/auth/messages";
import { ROUTES } from "@/lib/auth/routes";
import {
  fieldErrors,
  forgotPasswordSchema,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from "@/lib/auth/schemas";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  success?: boolean;
};

/**
 * Only allows relative paths, so a crafted link cannot use the sign-in
 * redirect to bounce a participant to an external site.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.account;
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Picked up by the `handle_new_user` trigger to fill `profiles`.
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl()}/auth/confirmation`,
    },
  });

  if (error) {
    return { message: authErrorMessage(error) };
  }

  return {
    success: true,
    message:
      "Compte créé. Vérifiez votre boîte de réception pour confirmer votre adresse e-mail.",
  };
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { message: authErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("suite")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect(ROUTES.home);
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${siteUrl()}${ROUTES.newPassword}` },
  );

  // Rate limiting is worth surfacing; anything else is not. The same
  // confirmation is returned whether or not the address has an account —
  // otherwise this form becomes a way to check who is registered.
  if (error && /rate limit/i.test(error.message)) {
    return { message: authErrorMessage(error) };
  }

  return {
    success: true,
    message:
      "Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d’être envoyé.",
  };
}

export async function setNewPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { message: authErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect(ROUTES.account);
}

export async function updateDisplayName(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateProfileSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Votre session a expiré. Reconnectez-vous." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) {
    // Uniqueness is enforced by a database index, so a clash surfaces here
    // rather than during validation — two people can pick the same
    // pseudonym at the same moment, and only the database can arbitrate.
    return { errors: { displayName: authErrorMessage(error) } };
  }

  revalidatePath(ROUTES.account);
  return { success: true, message: "Pseudonyme mis à jour." };
}
