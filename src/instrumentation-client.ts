import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/monitoring/scrub";

/**
 * Error reporting, in the browser.
 *
 * The one that matters most in November: a bug that only shows on a
 * particular phone, in the middle of a run, is a bug nobody will ever report
 * — the participant closes the app and moves on.
 *
 * Session replay is deliberately absent. It records what is on screen, which
 * here means a participant's activities and, on some pages, their e-mail
 * address. No amount of masking makes that safe to send to a third party
 * (architecture §8.5).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "development",

  sendDefaultPii: false,
  tracesSampleRate: 0,

  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubEvent(breadcrumb),
});

/**
 * Reports the navigation timing Next needs to attribute an error to a route.
 * Carries no personal data — it is the route pattern, not the address.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
