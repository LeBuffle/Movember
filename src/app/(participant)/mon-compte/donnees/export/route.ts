import { buildPersonalDataExport, exportFilename } from "@/lib/privacy/export";

/**
 * The participant's own data, as a file (story 11.1).
 *
 * **A route handler has no layout above it.** The middleware redirects
 * unauthenticated visitors, but a matcher change would silently expose this
 * one — so the authentication is established here, by the export itself,
 * which reads through the caller's session and returns nothing without a
 * user.
 *
 * 404 rather than 401 for a signed-out caller: this address should not
 * confirm anything to somebody who is not logged in.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await buildPersonalDataExport();

  if (!data) return new Response("Introuvable", { status: 404 });

  const today = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(today)}"`,
      // Never stored by a proxy or a browser: this is the one file in the
      // application that holds somebody's whole month of health data.
      "Cache-Control": "no-store, private",
    },
  });
}
