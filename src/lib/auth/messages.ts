/**
 * Turns Supabase's English error strings into French sentences a participant
 * can act on.
 *
 * Two rules are applied here, and both matter more than the translation:
 *
 * 1. **Never reveal whether an address has an account.** "Adresse ou mot de
 *    passe incorrect" covers both cases; saying "aucun compte avec cette
 *    adresse" would turn the sign-in form into a way to enumerate the
 *    participants of the edition.
 * 2. **Never surface a raw error.** An untranslated technical string tells
 *    the participant nothing and leaks implementation details.
 */

const MESSAGES: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials/i,
    message: "Adresse e-mail ou mot de passe incorrect.",
  },
  {
    match: /email not confirmed/i,
    message:
      "Votre adresse e-mail n’est pas encore confirmée. Vérifiez votre boîte de réception.",
  },
  {
    match: /user already registered|already been registered/i,
    message: "Un compte existe déjà avec cette adresse e-mail.",
  },
  {
    match: /password should be at least/i,
    message: "Le mot de passe doit contenir au moins 8 caractères.",
  },
  {
    match: /email rate limit exceeded|over_email_send_rate_limit/i,
    message:
      "Trop d’e-mails demandés en peu de temps. Patientez quelques minutes avant de réessayer.",
  },
  {
    match: /request rate limit reached|too many requests/i,
    message:
      "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  },
  {
    match: /token has expired|invalid or has expired/i,
    message:
      "Ce lien a expiré. Demandez-en un nouveau depuis la page de connexion.",
  },
  {
    match: /profiles_display_name_unique|duplicate key/i,
    message: "Ce pseudonyme est déjà utilisé. Choisissez-en un autre.",
  },
  {
    match: /unable to validate email address|invalid format/i,
    message: "Cette adresse e-mail n’est pas valide.",
  },
];

const FALLBACK =
  "Une erreur est survenue. Réessayez dans un instant — si cela persiste, contactez l’organisation.";

export function authErrorMessage(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  return MESSAGES.find(({ match }) => match.test(raw))?.message ?? FALLBACK;
}
