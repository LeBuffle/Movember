import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

import { OFFLINE_PATH } from "./src/lib/pwa/cache-policy";

const nextConfig: NextConfig = {
  /**
   * Produces a self-contained server bundle in `.next/standalone`, so the
   * runtime image only needs Node and the traced dependencies instead of the
   * whole `node_modules`. Keeps the image small enough to pull quickly on a
   * modest VPS.
   */
  output: "standalone",

  /**
   * Security headers are set by Traefik in front of the app
   * (deploy/docker-compose.yml), which is the single place they belong:
   * setting them in both would make it ambiguous which one actually applies.
   * This one is the exception — it must follow the response even if the
   * reverse proxy is bypassed.
   */
  poweredByHeader: false,

  experimental: {
    /**
     * Card visuals are uploaded through a server action (story 5.6), and the
     * default ceiling on a server action body is one megabyte — below the two
     * megabytes the bucket itself accepts. Left as it is, a volunteer
     * uploading a 1.5 MB picture would get a framework error rather than the
     * sentence the form is ready to show them.
     *
     * Three megabytes rather than two: the body carries the form fields as
     * well as the file, and the real limit is the one checked in
     * `src/lib/cards/form.ts` and by the bucket.
     */
    serverActions: { bodySizeLimit: "3mb" },
  },
};

/**
 * Service worker (story 1.8).
 *
 * Compiles `src/app/sw.ts` into `public/sw.js` and injects its registration
 * into the client bundle. What the worker may cache is decided in
 * `src/lib/pwa/cache-policy.ts`, which is an allow-list on purpose.
 *
 * **This is why the build runs `next build --webpack`.** Next 16 bundles with
 * Turbopack by default, Serwist does not support it, and the failure is
 * silent: the build succeeds, every route is there, and the application ships
 * with no service worker at all — no offline page, no push registration.
 * `tests/unit/build-config.test.ts` holds the flag in place.
 */
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",

  /* Off in development. A service worker serving yesterday's build is a
     genuinely confusing way to lose an afternoon, and none of what it does
     is useful against a dev server. Verification happens on staging, which
     is what the real devices are tested against anyway. */
  disable: process.env.NODE_ENV === "development",

  /* The offline page is not in the build manifest — it is a rendered route,
     not a file on disk — so it has to be named explicitly. `revision` is
     what tells an installed worker that the copy it holds is out of date.
     The deployment pipeline passes the commit sha (story 1.3), so a new
     deploy means a new revision; locally there is no pipeline and a
     timestamp has the same effect. */
  additionalPrecacheEntries: [
    {
      url: OFFLINE_PATH,
      revision: process.env.APP_VERSION ?? String(Date.now()),
    },
  ],
});

/**
 * Error reporting (story 1.11).
 *
 * Wraps the configuration last, so it sees the final result — including what
 * Serwist adds. Nothing is sent without `NEXT_PUBLIC_SENTRY_DSN`; the
 * wrapper is inert on its own.
 */
export default withSentryConfig(withSerwist(nextConfig), {
  /* Source map upload, which is what turns a minified stack trace into a
     line of our code. It only happens when a token is present, so a build
     without one still succeeds — which is every local build and, until the
     account exists, every deployment too. */
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  /* Maps are uploaded to Sentry, then deleted from the image. Leaving them
     served publicly would hand our whole source to anyone asking for it. */
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  /**
   * Removes the parts of the error reporter we do not use.
   *
   * Sentry ships performance tracing and a debug logger in the same bundle as
   * error reporting. Both are dead weight here — tracing is off
   * (`tracesSampleRate: 0`) and the logger only speaks in development — but
   * they are only dropped when these flags are set, because they sit behind
   * runtime checks a bundler cannot otherwise resolve.
   *
   * This used to be a hand-written `webpack.DefinePlugin` in the Next
   * configuration above. The SDK now does exactly the same thing under its
   * own option, and having it here rather than there means the day Sentry
   * renames a flag, it renames it for us too.
   *
   * It matters on the participant side: the application is opened on a phone,
   * often on a poor connection, sometimes mid-run. Every kilobyte here is
   * paid by someone standing in the cold.
   */
  webpack: {
    treeshake: { removeDebugLogging: true, removeTracing: true },
  },

  /* Routes the browser's reports through our own domain, so an ad blocker
     does not silently swallow them — which would leave us believing there
     are no client-side errors. */
  tunnelRoute: "/monitoring",
});
