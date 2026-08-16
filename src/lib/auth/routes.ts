/**
 * Which URL prefixes require a session, and which require an admin.
 *
 * Kept in one place because Next.js route groups — `(participant)`,
 * `(admin)` — do not appear in the URL. The middleware cannot infer
 * protection from the folder structure, so the list has to be explicit.
 *
 * **Adding a protected page means adding its prefix here.** Forgetting it
 * leaves the page publicly reachable without any error to warn you.
 */

/** Requires a signed-in user. */
export const PARTICIPANT_PREFIXES = [
  "/mon-compte",
  "/jeu",
  /* Choosing a tier and accepting the terms. Protected because it records an
     acceptance under someone's name — that requires knowing whose. */
  "/participer",
  /* Where a suspended participant lands. Behind a session because it names
     the reason they were set aside (story 8.7). */
  "/suspendu",
] as const;

/** Requires a signed-in user whose role is `admin`. */
export const ADMIN_PREFIXES = ["/admin"] as const;

/** Sign-in pages, redirected away from when already signed in. */
export const AUTH_ROUTES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
] as const;

export const ROUTES = {
  signIn: "/connexion",
  signUp: "/inscription",
  forgotPassword: "/mot-de-passe-oublie",
  newPassword: "/nouveau-mot-de-passe",
  account: "/mon-compte",
  participate: "/participer",
  home: "/",
} as const;

/**
 * Where to send somebody who is not signed in.
 *
 * **Not always the sign-in page.** Somebody who just chose a formula on the
 * public page has, by definition, no account yet — sending them to a form
 * asking for a password they never set is the moment a funnel loses people.
 * They get the account-creation screen instead, which carries "déjà inscrit ?
 * se connecter" for the minority who are.
 *
 * The reverse for `/jeu` or `/mon-compte`: reaching those means a bookmark or
 * a habit, so an account almost certainly exists.
 */
export function entryRouteFor(pathname: string): string {
  return matches(pathname, ["/participer"]) ? ROUTES.signUp : ROUTES.signIn;
}

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function requiresSession(pathname: string): boolean {
  return (
    matches(pathname, PARTICIPANT_PREFIXES) || matches(pathname, ADMIN_PREFIXES)
  );
}

export function requiresAdmin(pathname: string): boolean {
  return matches(pathname, ADMIN_PREFIXES);
}

export function isAuthRoute(pathname: string): boolean {
  return matches(pathname, AUTH_ROUTES);
}
