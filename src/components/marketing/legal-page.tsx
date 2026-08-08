import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/alert";
import { DRAFT_LEGAL_NOTICE } from "@/lib/legal/notices";

/**
 * Shell shared by the three legal pages.
 *
 * Carries the draft banner, which is the point of it. A provisional legal
 * page that does not say it is provisional is worse than no page at all: a
 * visitor reads it as binding, and the association would be answering for
 * text nobody validated. The banner is not optional and not per-page, so it
 * cannot be forgotten on one of the three.
 *
 * `tests/unit/legal.test.ts` fails if a legal page stops going through this
 * component while still carrying draft text.
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

        <Alert tone="warning" title="Document de travail" className="mt-6">
          {DRAFT_LEGAL_NOTICE}
        </Alert>

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
