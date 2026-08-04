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

export default withSerwist(nextConfig);
