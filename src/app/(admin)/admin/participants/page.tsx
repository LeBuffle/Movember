import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { listParticipants } from "@/lib/admin/participants";

export const metadata = {
  title: "Participants — back-office",
};

export const dynamic = "force-dynamic";

/**
 * The support screen (story 8.2).
 *
 * Somebody writes "je ne reçois plus mes défis". The answer is one line here:
 * is the registration active, and is a sporting account linked? Without this
 * screen the same question costs four screens and a cross-reference.
 *
 * **The e-mail address appears here and on the participant's own record, and
 * nowhere else in the application.** The organisation needs it to reply;
 * participants never see it.
 *
 * The search is a plain form with a GET: the term stays in the address, so a
 * result can be sent to a colleague and the back button behaves. No
 * JavaScript is involved, which also means it works on the flaky connection
 * of a volunteer answering messages from a train.
 */
export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = Number(params.page ?? "1") || 1;

  const result = await listParticipants(page, query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Participants
        </h1>
        <p className="text-ink-muted mt-2">
          Qui est inscrit, à quel niveau, et si ses sorties remontent.
        </p>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Rechercher un participant
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={result.query}
          placeholder="Pseudonyme ou adresse e-mail"
          className="border-line text-ink min-h-11 flex-1 rounded-lg border px-3 py-2 text-base"
        />
        <button type="submit" className={buttonClasses()}>
          Rechercher
        </button>
      </form>

      {result.rows.length === 0 ? (
        <Alert
          tone="info"
          title={result.query ? "Aucun résultat" : "Aucun participant"}
        >
          {result.query
            ? `Rien ne correspond à « ${result.query} ». Vérifiez l’orthographe du pseudonyme, ou cherchez par adresse e-mail.`
            : "Les participants apparaîtront ici au fur et à mesure des inscriptions."}
        </Alert>
      ) : (
        <>
          <p className="text-ink-muted text-sm">
            {result.total} participant{result.total > 1 ? "s" : ""}
            {result.query ? ` pour « ${result.query} »` : ""}.
          </p>

          <ul className="space-y-3">
            {result.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/participants/${row.id}`}
                  className="border-line bg-surface hover:border-brand-blue block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink font-semibold">
                      {row.displayName}
                    </span>
                    <RegistrationBadge status={row.registrationStatus} />
                    <ConnectionBadge state={row.connection} />
                  </div>

                  <p className="text-ink-muted mt-1 text-sm break-all">
                    {row.email}
                  </p>

                  {row.tier && (
                    <p className="text-ink-muted mt-1 text-sm">
                      Niveau {row.tier}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {result.pageCount > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between gap-3"
            >
              <PageLink
                href={pageHref(result.page - 1, result.query)}
                disabled={result.page <= 1}
              >
                Précédents
              </PageLink>

              <span className="text-ink-muted text-sm">
                Page {result.page} sur {result.pageCount}
              </span>

              <PageLink
                href={pageHref(result.page + 1, result.query)}
                disabled={result.page >= result.pageCount}
              >
                Suivants
              </PageLink>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The registration, in one word.
 *
 * Everything except `active` is worth noticing: it is the difference between
 * "the game refuses to open for them" and "they have simply not paid yet".
 */
function RegistrationBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="neutral">Pas d’inscription</Badge>;
  if (status === "active")
    return <Badge tone="success">Inscription active</Badge>;
  if (status === "refunded") return <Badge tone="orange">Remboursée</Badge>;

  return <Badge tone="orange">Inscription {status}</Badge>;
}

function ConnectionBadge({ state }: { state: "none" | "linked" | "broken" }) {
  if (state === "linked") return <Badge tone="success">Strava relié</Badge>;
  if (state === "broken") return <Badge tone="danger">Liaison rompue</Badge>;

  return <Badge tone="neutral">Pas de Strava</Badge>;
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return search ? `/admin/participants?${search}` : "/admin/participants";
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
