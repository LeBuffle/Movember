import { requireAdmin } from "@/lib/admin/guard";
import {
  accountingFilename,
  getAccountingLines,
  toAccountingCsv,
} from "@/lib/accounting/export";
import { EDITION_YEAR } from "@/lib/edition/calendar";

/**
 * The accounting export, downloaded (story 9.3).
 *
 * A route rather than a button, because a file has to arrive as a file. The
 * same three precautions as the delivery export, and for the same reasons:
 *
 *   - **the role is checked again**. This sits under `(admin)`, but a route
 *     handler has no layout above it: the guard that protects every admin
 *     *page* does not run here.
 *   - **nothing is cached**. This response lists what every participant paid.
 *   - **it is an attachment**. Opened in a tab, it ends up in the history of
 *     a shared machine.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    // Same answer as an unknown route. Someone probing learns exactly what
    // someone mistyping learns.
    return new Response(null, { status: 404 });
  }

  const lines = await getAccountingLines();

  return new Response(toAccountingCsv(lines), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${accountingFilename(
        EDITION_YEAR,
        new Date().toISOString().slice(0, 10),
      )}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
