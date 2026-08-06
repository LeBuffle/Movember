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
    // **The window is an hour, not a few minutes**, and saying otherwise is
    // worse than saying nothing: somebody retries three times, gets the same
    // refusal, and concludes the site is broken. The limit belongs to the
    // e-mail sender, not to us — and it disappears once a real sending
    // service is wired in (see supabase/EMAILS.md).
    match: /email rate limit exceeded|over_email_send_rate_limit/i,
    message:
      "L’envoi d’e-mails est momentanément saturé. Réessayez dans une heure, ou écrivez à l’organisation — votre compte n’a pas été créé.",
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

/**
 * Messages for the failures that happen on an e-mail link, before any form
 * is submitted.
 *
 * `/auth/confirmation` sends the participant back to the sign-in page with a
 * code in the address when the link cannot be honoured. Without this, that
 * page rendered an empty form and said nothing — the participant clicked a
 * link, landed on a login screen, and had no idea why.
 *
 * The "wrong browser" case is the one worth wording carefully: it is not a
 * broken link, and telling someone their link expired when it did not sends
 * them requesting a new one that will fail the same way.
 */
const LINK_ERRORS: Record<string, string> = {
  "lien-invalide":
    "Ce lien est incomplet. Ouvrez-le directement depuis l’e-mail plutôt que de le recopier, ou demandez-en un nouveau.",
  "lien-expire":
    "Ce lien n’a pas pu être utilisé. Il a peut-être expiré, ou vous l’avez ouvert dans un autre navigateur que celui où vous vous êtes inscrit — dans ce cas, rouvrez-le depuis le même appareil et le même navigateur.",
};

export function linkErrorMessage(code: string | undefined): string | undefined {
  return code ? LINK_ERRORS[code] : undefined;
}

export function authErrorMessage(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  return MESSAGES.find(({ match }) => match.test(raw))?.message ?? FALLBACK;
}
