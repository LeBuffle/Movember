import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { signUp } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";

export const metadata = { title: "Créer un compte — DEFI Movember" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;

  return (
    <AuthForm
      title="Créer un compte"
      intro="Votre pseudonyme sera visible dans les classements. Votre nom et votre adresse e-mail ne le seront jamais."
      action={signUp}
      submitLabel="Créer mon compte"
      // Carries the page the visitor was heading for — a chosen tier, most
      // often — all the way through the confirmation e-mail, so they land
      // back on it rather than on the home page.
      hiddenFields={{ suite: suite ?? "" }}
      fields={[
        {
          name: "displayName",
          label: "Pseudonyme",
          autoComplete: "nickname",
          required: true,
          hint: "Entre 2 et 30 caractères. Visible par les autres participants.",
        },
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
          autoComplete: "new-password",
          required: true,
          hint: "Au moins 8 caractères. Une phrase longue vaut mieux qu’un mot compliqué.",
        },
      ]}
      footer={
        <p>
          Déjà inscrit ?{" "}
          <AuthLink
            href={
              suite
                ? `${ROUTES.signIn}?suite=${encodeURIComponent(suite)}`
                : ROUTES.signIn
            }
          >
            Se connecter
          </AuthLink>
        </p>
      }
    />
  );
}
