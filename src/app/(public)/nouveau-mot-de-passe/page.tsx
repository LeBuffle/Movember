import { AuthForm } from "@/components/auth/auth-form";
import { setNewPassword } from "@/lib/auth/actions";

export const metadata = { title: "Nouveau mot de passe — DEFI Movember" };

/**
 * Reached through the link e-mailed by the reset flow. Supabase establishes a
 * short-lived session from that link, which is what authorises the change.
 */
export default function NewPasswordPage() {
  return (
    <AuthForm
      title="Nouveau mot de passe"
      intro="Choisissez un nouveau mot de passe pour votre compte."
      action={setNewPassword}
      submitLabel="Enregistrer"
      fields={[
        {
          name: "password",
          label: "Nouveau mot de passe",
          type: "password",
          autoComplete: "new-password",
          required: true,
          hint: "Au moins 8 caractères.",
        },
      ]}
    />
  );
}
