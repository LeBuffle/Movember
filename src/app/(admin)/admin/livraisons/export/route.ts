import { requireAdmin } from "@/lib/admin/guard";
import { getDeliveries } from "@/lib/shipping/deliveries";
import { exportFilename, toCsv } from "@/lib/shipping/export";
import { EDITION_YEAR } from "@/lib/edition/calendar";

/**
 * The delivery list, downloaded.
 *
 * A route rather than a button on the page, because a file has to arrive as a
 * file. Three things matter here and each has a reason:
 *
 *   - **the role is checked again**. This sits under `(admin)`, but a route
 *     handler has no layout above it: the guard that protects every admin
 *     *page* does not run here. Forgetting this line would publish every
 *     participant's home address to anyone who guessed the URL.
 *   - **nothing is cached, anywhere**. This response is a list of names and
 *     street addresses; a copy left in a proxy or a browser cache is a copy
 *     nobody knows about.
 *   - **it is an attachment**. Opened in a tab, a CSV of addresses ends up in
 *     the history of a shared machine.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    // Same answer as an unknown route. Someone probing learns exactly what
    // someone mistyping learns.
    return new Response(null, { status: 404 });
  }

  const { rows } = await getDeliveries();
  const filename = exportFilename(
    EDITION_YEAR,
    new Date().toISOString().slice(0, 10),
  );

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
