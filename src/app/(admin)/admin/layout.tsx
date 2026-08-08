import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/admin/guard";
import { APP_ENVIRONMENT } from "@/lib/app-version";

export const metadata = {
  title: "Back-office — DEFI Movember",
  robots: { index: false, follow: false },
};

/**
 * Evaluated per request. Without this the shell could be prerendered at build
 * time, and the role check below would run once, at build, for nobody.
 */
export const dynamic = "force-dynamic";

/**
 * Back-office shell.
 *
 * The role check happens here rather than on each page, so a section added
 * later by another epic is protected the moment its file exists — nobody has
 * to remember to add a guard.
 *
 * `notFound()` rather than an "accès refusé" message. AC 2 asks for a refusal
 * that is both clear and free of leaks, and those pull against each other:
 * "vous n'avez pas le rôle administrateur" is clear and tells a signed-in
 * participant that a back-office exists and that a role guards it. The 404 is
 * unambiguous — the page is not there for them — and someone probing learns
 * exactly what someone mistyping a URL learns.
 *
 * This applies to a signed-in participant, which is the case AC 2 is about.
 * Someone signed out is redirected to the sign-in page by the middleware,
 * which does reveal the path. That is a deliberate trade: `/admin` is the
 * most guessable path on the internet, and a volunteer whose session expired
 * mid-November should be told to sign in rather than shown a 404.
 *
 * The middleware already turns away non-admins before reaching this. Both
 * exist on purpose: the middleware is a routing rule and a change to its
 * matcher would silently disable it, while this runs no matter how the page
 * is reached. Row level security is the third layer, and refuses the queries
 * themselves.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    notFound();
  }

  return (
    <>
      <header className="border-line bg-surface border-b">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-brand-blue text-lg font-extrabold tracking-tight">
                DEFI
              </span>
              <span className="text-ink-muted text-sm font-medium">
                back-office
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Naming the environment in the header of the back-office is
                  cheap insurance: production and staging look identical, and
                  the day someone cancels a real challenge believing they are
                  on staging is the day this pays for itself. */}
              {APP_ENVIRONMENT !== "production" && (
                <Badge tone="orange">{APP_ENVIRONMENT}</Badge>
              )}
              <span className="text-ink-muted text-sm">
                {admin.displayName}
              </span>
            </div>
          </div>

          <AdminNav />
        </div>
      </header>

      <main id="contenu" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>

      <SiteFooter />
    </>
  );
}
