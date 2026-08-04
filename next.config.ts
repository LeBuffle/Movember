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

  /**
   * Removes the parts of the error reporter we do not use.
   *
   * Sentry ships performance tracing and a debug logger in the same bundle
   * as error reporting. Both are dead weight here — tracing is off
   * (`tracesSampleRate: 0`) and the logger only speaks in development — but
   * they are only actually dropped when these flags are defined, because
   * they sit behind runtime checks the bundler cannot otherwise resolve.
   *
   * This matters on the participant side: the application is opened on a
   * phone, often on a poor connection, sometimes mid-run. Every kilobyte
   * here is paid by someone standing in the cold.
   */
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_DEBUG__: false,
        __SENTRY_TRACING__: false,
      }),
    );

    return config;
  },
};

/**
 * Service worker (story 1.8).
 *
 * Compiles `src/app/sw.ts` into `public/sw.js` and injects its registration
 * into the client bundle. What the worker may cache is decided in
 * `src/lib/pwa/cache-policy.ts`, which is an allow-list on purpose.
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

  /* Routes the browser's reports through our own domain, so an ad blocker
     does not silently swallow them — which would leave us believing there
     are no client-side errors. */
  tunnelRoute: "/monitoring",

  disableLogger: true,
});
