import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { requestPasswordReset } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";

export const metadata = { title: "Mot de passe oublié — DEFI Movember" };

export default function ForgotPasswordPage() {
  return (
    <AuthForm
      title="Mot de passe oublié"
      intro="Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      action={requestPasswordReset}
      submitLabel="Envoyer le lien"
      fields={[
        {
          name: "email",
          label: "Adresse e-mail",
          type: "email",
          autoComplete: "email",
          required: true,
        },
      ]}
      footer={<AuthLink href={ROUTES.signIn}>Retour à la connexion</AuthLink>}
    />
  );
}
