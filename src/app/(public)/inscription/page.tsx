import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { signUp } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";
import { getRegistrationTiers } from "@/lib/registration/tiers";

export const metadata = { title: "Créer un compte — DEFI Movember" };

/**
 * The formula the visitor was heading for, if any.
 *
 * `suite` is `/participer/<slug>` when somebody picked a tier on the public
 * page and was sent here to create the account. Naming it back to them is
 * what keeps the two steps feeling like one: a form that has forgotten what
 * you just chose reads as a form that lost it.
 */
async function chosenTier(suite: string | undefined) {
  const slug = suite?.match(/^\/participer\/([a-z0-9-]+)$/)?.[1];
  if (!slug) return null;

  const tiers = await getRegistrationTiers();
  return tiers.find((tier) => tier.slug === slug) ?? null;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;
  const tier = await chosenTier(suite);

  return (
    <AuthForm
      title="Créer un compte"
      intro={
        tier
          ? `Dernière étape avant le paiement. Votre pseudonyme sera visible dans les classements ; votre nom et votre adresse e-mail ne le seront jamais.`
          : "Votre pseudonyme sera visible dans les classements. Votre nom et votre adresse e-mail ne le seront jamais."
      }
      banner={
        tier ? (
          <div className="border-brand-orange bg-brand-orange-soft rounded-xl border p-3">
            <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
              Formule choisie
            </p>
            <p className="text-ink mt-0.5 font-bold">
              {tier.name} — {(tier.priceCents / 100).toLocaleString("fr-FR")} €
            </p>
          </div>
        ) : undefined
      }
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
