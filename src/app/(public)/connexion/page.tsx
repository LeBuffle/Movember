import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { signIn } from "@/lib/auth/actions";
import { linkErrorMessage } from "@/lib/auth/messages";
import { ROUTES } from "@/lib/auth/routes";

export const metadata = { title: "Connexion — DEFI Movember" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  const { suite, erreur } = await searchParams;

  return (
    <AuthForm
      title="Connexion"
      action={signIn}
      submitLabel="Se connecter"
      // `/auth/confirmation` sends people here with a code when an e-mail
      // link cannot be honoured. Without this the page rendered an empty
      // form and explained nothing.
      notice={linkErrorMessage(erreur)}
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
            {/* `suite` suit jusqu'à l'inscription. Sans cela, quelqu'un qui
                a choisi « Sportif légendaire », crée un compte et retombe
                sur l'accueil doit tout refaire — ou renonce. */}
            <AuthLink
              href={
                suite
                  ? `${ROUTES.signUp}?suite=${encodeURIComponent(suite)}`
                  : ROUTES.signUp
              }
            >
              Créer un compte
            </AuthLink>
          </p>
        </div>
      }
    />
  );
}
