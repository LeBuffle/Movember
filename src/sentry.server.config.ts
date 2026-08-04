import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/monitoring/scrub";

/**
 * Error reporting, server side.
 *
 * Inert without a DSN, which is the state in development and on any machine
 * where the account has not been wired up. Nothing to guard at the call
 * sites.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.APP_ENVIRONMENT ?? "development",
  release: process.env.APP_VERSION,

  /* Would attach the IP address and the request headers to every report,
     bypassing our own filter entirely. */
  sendDefaultPii: false,

  /* Errors only. Performance tracing multiplies the volume sent for
     information we have no use for on a site this size, and the free tier is
     what keeps this project's running costs at zero. */
  tracesSampleRate: 0,

  /* The last line before anything leaves the server. See `scrub.ts` for what
     it removes and why. */
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubEvent(breadcrumb),
});
