import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { signIn } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";

export const metadata = { title: "Connexion — DEFI Movember" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;

  return (
    <AuthForm
      title="Connexion"
      action={signIn}
      submitLabel="Se connecter"
      // Carries the page the participant was trying to reach, so they land
      // there rather than on a generic page after signing in.
      hiddenFields={{ suite: suite ?? "" }}
      fields={[
        {
          name: "email",
          label: "Adresse e-mail",
          type: "email",
          autoComplete: "email",
          required: true,
        },
        {
          name: "password",
          label: "Mot de passe",
          type: "password",
          autoComplete: "current-password",
          required: true,
        },
      ]}
      footer={
        <div className="space-y-2">
          <p>
            <AuthLink href={ROUTES.forgotPassword}>
              Mot de passe oublié ?
            </AuthLink>
          </p>
          <p>
            Pas encore de compte ?{" "}
            <AuthLink href={ROUTES.signUp}>Créer un compte</AuthLink>
          </p>
        </div>
      }
    />
  );
}
