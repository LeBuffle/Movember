/**
 * Next's instrumentation hook: runs once, before anything else, in each
 * runtime the application uses.
 *
 * The two configurations are imported dynamically rather than at the top of
 * the file because only one of them applies per runtime, and importing the
 * Node one into the edge runtime fails at build time.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Reports errors thrown while rendering on the server, which otherwise only
 * reach the container log — where nobody is looking on a Sunday evening.
 */
export { captureRequestError as onRequestError } from "@sentry/nextjs";
