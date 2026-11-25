/**
 * The application's public address.
 *
 * **Never derive this from the incoming request.** It is tempting —
 * `request.nextUrl.origin` looks exactly like what is wanted — and it is
 * wrong here, for two separate reasons.
 *
 * The first is factual, and it cost a real confirmation e-mail. Next's
 * standalone server builds that origin from the address it is bound to, not
 * from the host the visitor typed. Inside the container that address is
 * `0.0.0.0:3000`, so a redirect built from it sent a participant to
 * `http://0.0.0.0:3000/mon-compte` — a page no browser can reach.
 * Reproduced with the real production server, `Host` and `X-Forwarded-*`
 * headers included: they make no difference.
 *
 * The second is a security one, and it holds even where the first does not.
 * `X-Forwarded-Host` is a header, and a header can be sent by anyone. An
 * application that builds its redirects from it hands an attacker a way to
 * bounce someone from a legitimate link to a site of their choosing —
 * exactly the moment a participant is least suspicious, since they clicked a
 * link we sent them.
 *
 * An environment variable is set by whoever deploys the application, and by
 * nobody else. `deploy/README.md` covers it; a missing value falls back to
 * the development address, which is right where there is no deployment.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Absolute URL for a path within the site. */
export function absoluteUrl(path: string): string {
  return `${siteUrl().replace(/\/$/, "")}${path}`;
}
