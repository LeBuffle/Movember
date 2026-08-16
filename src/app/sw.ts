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

/* =========================================================================
 * Notifications (story 6.1)
 *
 * Added after `addEventListeners` on purpose: Serwist owns fetch, install and
 * activate; these two events are ours and it does not touch them.
 *
 * **Nothing here reads the participant's data.** The payload is written by
 * the sender and carries a title, a body and a path — no identifier, no
 * score, nothing the notification does not already display. A push payload
 * lives on the device and in the push service's queue; what is not sent
 * cannot leak from either.
 * ====================================================================== */

type PushPayload = {
  title?: string;
  body?: string;
  /** Where to land when the notification is touched. Same-origin path. */
  url?: string;
  /** Groups notifications that replace one another (story 6.6). */
  tag?: string;
};

self.addEventListener("push", (event) => {
  /* A push with no payload is a real case — some services send one to wake
     the worker — and a worker that throws here is a worker that stops
     handling the next one too. */
  const payload = readPayload(event.data);

  const title = payload.title ?? "DEFI Movember";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      /* Same tag replaces rather than stacks. Three challenges validated by
         one Sunday outing must read as one event, not three (story 6.6). */
      tag: payload.tag,
      data: { url: payload.url ?? "/jeu" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = safePath(
    (event.notification.data as { url?: string } | undefined)?.url,
  );

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      /* An already-open window is focused and navigated rather than joined by
         a second one. On a phone, opening a duplicate of an app that is
         already running is a good way to lose whatever was on screen. */
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});

function readPayload(data: PushMessageData | null): PushPayload {
  if (!data) return {};

  try {
    return (data.json() ?? {}) as PushPayload;
  } catch {
    /* Not JSON: treat whatever arrived as the body rather than dropping the
       notification. A silent drop is indistinguishable from a broken send. */
    return { body: data.text() };
  }
}

/**
 * Only ever navigates within the application.
 *
 * The payload is written by our own sender, so this is not defence against
 * an attacker — it is defence against a typo in a message composed from the
 * back-office (story 6.8) turning into a redirect to somewhere else.
 */
function safePath(url: string | undefined): string {
  if (!url || !/^\/(?![/\\])/.test(url)) return "/jeu";

  return url;
}
