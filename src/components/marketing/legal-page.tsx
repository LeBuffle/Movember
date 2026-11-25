import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Shell shared by the three legal pages.
 *
 * It carried a "working draft" banner until the PO validated the three texts
 * on 14 August. The banner is gone with them: a page that still warned it had
 * no contractual value would now be a false statement on the very pages a
 * visitor is meant to rely on — the mirror image of the risk the banner was
 * there to cover.
 *
 * What stays is the last-updated date, which is what lets a reader judge the
 * text's freshness. `tests/unit/legal.test.ts` pins both: that the three
 * pages go through this shell, and that the draft wording is not reintroduced
 * on one of them alone.
 */
export function LegalPage({
  title,
  updatedOn,
  children,
}: {
  title: string;
  /** ISO date of the last edit, shown so a reader can judge its freshness. */
  updatedOn: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />

      <main id="contenu" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-ink text-3xl font-bold tracking-tight">{title}</h1>

        <p className="text-ink-muted mt-2 text-sm">
          Dernière mise à jour :{" "}
          <time dateTime={updatedOn}>
            {new Date(updatedOn).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>

        {/*
          `space-y` rather than a typography plugin: three pages of plain
          prose do not justify a dependency, and the rules below are the ones
          those three pages actually use.
        */}
        <div className="[&_h2]:text-ink [&_li]:text-ink-muted [&_p]:text-ink-muted mt-8 space-y-6 [&_h2]:pt-2 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
