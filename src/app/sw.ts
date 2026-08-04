/// <reference lib="webworker" />

/**
 * Service worker.
 *
 * Compiled by `@serwist/next` at build time into `public/sw.js`, which is
 * generated and not committed. Registration is handled by the plugin.
 *
 * Two rules govern everything below.
 *
 * 1. **Cache an allow-list, never a deny-list.** The only things kept on the
 *    device are hashed build assets and the icons — see
 *    `src/lib/pwa/cache-policy.ts`. Requests that match nothing here are not
 *    handled at all and go straight to the network, which is exactly what we
 *    want for anything carrying a participant's data (story 1.8 AC 7).
 *
 * 2. **No `defaultCache`.** Serwist ships a ready-made configuration under
 *    `@serwist/next/worker`. It is convenient and it is wrong for this app:
 *    it caches pages and API responses, which here means Strava activities,
 *    e-mail addresses and payment state. `tests/unit/pwa.test.ts` fails if
 *    that import ever appears in this file.
 */

import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";

import { CACHEABLE_PREFIXES, OFFLINE_PATH } from "@/lib/pwa/cache-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Injected at build time by `@serwist/next`. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const [NEXT_STATIC_PREFIX, ICONS_PREFIX] = CACHEABLE_PREFIXES;

const runtimeCaching: RuntimeCaching[] = [
  {
    /* Build assets. The filename carries a content hash, so cache-first is
       safe: a changed file is a different URL, never a stale hit. */
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith(NEXT_STATIC_PREFIX),
    handler: new CacheFirst({ cacheName: "static-assets" }),
  },
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith(ICONS_PREFIX),
    handler: new CacheFirst({
      cacheName: "app-icons",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  },
  {
    /* Every page load. `NetworkOnly` means exactly that — nothing is stored,
       no page ever comes out of a cache. The entry exists only so that a
       failed navigation has somewhere to land: without a matching route,
       Serwist never gets to run, and the participant sees the browser's own
       error page instead of ours (AC 8). */
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  /* Both are what makes AC 9 work: a new version takes over as soon as it is
     installed instead of waiting for every tab to be closed. During November
     a fix has to reach participants the same day, and asking them to
     reinstall is not an option. */
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_PATH,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
