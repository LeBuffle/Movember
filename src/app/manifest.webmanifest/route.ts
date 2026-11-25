import { appManifest } from "@/lib/pwa/manifest";

/**
 * Serves the web app manifest.
 *
 * A plain route handler rather than the `app/manifest.ts` convention: that
 * convention makes Next inject its own `<link rel="manifest">`, and that
 * link cannot carry `crossOrigin`. See the root layout for why we need it.
 *
 * Static: the manifest is the same for everyone and never depends on a
 * request.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(appManifest, {
    headers: {
      /* The registered type for a manifest. Browsers are lenient about it,
         but validators and Lighthouse are not. */
      "content-type": "application/manifest+json",
    },
  });
}
