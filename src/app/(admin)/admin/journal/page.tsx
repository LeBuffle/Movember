import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { getJournal } from "@/lib/admin/journal";

export const metadata = {
  title: "Journal — back-office",
};

export const dynamic = "force-dynamic";

/**
 * What the organisation has done (story 8.8).
 *
 * **Its reason for existing is the day a participant contests a decision.**
 * A challenge invalidated, a refund, a suspension: it has to be possible to
 * say who did what, when, and why — including by somebody who was not there.
 *
 * Read-only, and nothing on this screen can change that: the table carries no
 * update policy and no delete policy. A journal that can be edited is not a
 * journal.
 *
 * The filter lives in the address bar rather than in component state, like
 * the rankings: a filtered journal can be sent to somebody, and the back
 * button behaves.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const params = await searchParams;
  const action = params.action?.trim() || undefined;
  const page = Number(params.page ?? "1") || 1;

  const journal = await getJournal(page, action);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-ink-muted mt-2">
          Les actions de l’organisation, la plus récente en premier. Rien ne s’y
          modifie et rien ne s’y supprime.
        </p>
      </div>

      {journal.actions.length > 0 && (
        <nav aria-label="Filtrer par action" className="flex flex-wrap gap-2">
          <FilterChip href="/admin/journal" active={!action}>
            Tout
          </FilterChip>

          {journal.actions.map((verb) => (
            <FilterChip
              key={verb}
              href={`/admin/journal?action=${encodeURIComponent(verb)}`}
              active={action === verb}
            >
              {verb}
            </FilterChip>
          ))}
        </nav>
      )}

      {journal.entries.length === 0 ? (
        <Alert tone="info" title="Aucune action journalisée">
          {action
            ? "Aucune action de ce type pour le moment."
            : "Les gestes de l’organisation apparaîtront ici : arbitrage d’un défi, remboursement, publication, envoi de notification."}
        </Alert>
      ) : (
        <>
          <p className="text-ink-muted text-sm">
            {journal.total} action{journal.total > 1 ? "s" : ""}
            {action ? ` de type « ${action} »` : ""}.
          </p>

          <ul className="space-y-3">
            {journal.entries.map((entry) => (
              <li
                key={entry.id}
                className="border-line bg-surface rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{entry.action}</Badge>
                  <time
                    dateTime={entry.createdAt}
                    className="text-ink-muted text-sm"
                  >
                    {formatMoment(entry.createdAt)}
                  </time>
                </div>

                <p className="text-ink mt-2 font-medium">Par {entry.author}</p>

                {entry.targetTable && (
                  <p className="text-ink-muted mt-1 text-sm">
                    Sur {entry.targetTable}
                    {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}…` : ""}
                  </p>
                )}

                {/* The context the action recorded — a reason, a title, an
                    amount. Rendered as plain text: the payload is written by
                    the application, but a motive typed by a volunteer travels
                    through it. */}
                {Object.keys(entry.payload).length > 0 && (
                  <dl className="border-line mt-3 space-y-1 border-t pt-3 text-sm">
                    {Object.entries(entry.payload).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="text-ink-muted shrink-0">{key}</dt>
                        <dd className="text-ink min-w-0 break-words">
                          {typeof value === "string"
                            ? value
                            : JSON.stringify(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>

          {journal.pageCount > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between gap-3"
            >
              <PageLink
                href={pageHref(journal.page - 1, action)}
                disabled={journal.page <= 1}
              >
                Plus récentes
              </PageLink>

              <span className="text-ink-muted text-sm">
                Page {journal.page} sur {journal.pageCount}
              </span>

              <PageLink
                href={pageHref(journal.page + 1, action)}
                disabled={journal.page >= journal.pageCount}
              >
                Plus anciennes
              </PageLink>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function pageHref(page: number, action?: string): string {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/journal?${query}` : "/admin/journal";
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "min-h-9 rounded-full border px-3 py-1.5 text-sm font-medium",
        active
          ? "border-brand-blue bg-brand-blue-soft text-brand-blue"
          : "border-line text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="text-ink-muted min-h-11 px-2 py-2 text-sm opacity-50">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="text-brand-blue min-h-11 px-2 py-2 text-sm font-semibold underline underline-offset-4"
    >
      {children}
    </Link>
  );
}

function formatMoment(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
