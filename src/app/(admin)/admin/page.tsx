import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { EDITION_MILESTONES, EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * Back-office home.
 *
 * Indicators are real where they can be and absent where they cannot. The
 * participant count comes from the database; everything else waits for the
 * epic that produces it. A dashboard full of invented figures is worse than
 * an empty one — it is trusted, and it is wrong.
 *
 * The role has already been established by the layout. This page still goes
 * through row level security for its query, which is the layer that would
 * refuse it if the other two had been bypassed.
 */
export default async function AdminHome() {
  const supabase = await createClient();

  // `head: true` asks Postgres for the count without shipping the rows: the
  // number is all that is displayed, and profiles carry e-mail addresses.
  const { count: participants, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const pending = ADMIN_SECTIONS.filter(
    (section) => section.status === "comingSoon",
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          Animation de l’édition {EDITION_YEAR}
        </h1>
        <p className="text-ink-muted mt-2">
          Le back-office se remplit au fil des développements. Les sections
          listées ci-dessous existent déjà comme emplacements ; leurs écrans
          arrivent avec les lots indiqués.
        </p>
      </div>

      <section aria-labelledby="indicateurs" className="space-y-4">
        <h2 id="indicateurs" className="text-ink text-xl font-bold">
          Où en est l’édition
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardTitle>Comptes créés</CardTitle>
            <CardBody>
              {error ? (
                <p className="text-danger">Indicateur indisponible.</p>
              ) : (
                <p className="text-brand-blue text-3xl font-extrabold">
                  {participants ?? 0}
                </p>
              )}
              <p className="mt-1 text-sm">
                Comptes actifs, inscriptions payées comprises ou non.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardTitle>Collecte</CardTitle>
            <CardBody>
              <Badge tone="neutral">À venir — epic 9</Badge>
              <p className="mt-2 text-sm">
                Total encaissé, remboursements et frais.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardTitle>Défis publiés</CardTitle>
            <CardBody>
              <Badge tone="neutral">À venir — epic 4</Badge>
              <p className="mt-2 text-sm">
                Le catalogue et le calendrier de diffusion.
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      <section aria-labelledby="jalons" className="space-y-4">
        <h2 id="jalons" className="text-ink text-xl font-bold">
          Les dates
        </h2>
        <ul className="border-line divide-line divide-y border-y">
          {EDITION_MILESTONES.map((milestone) => (
            <li
              key={milestone.date}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-x-4"
            >
              <time
                dateTime={milestone.date}
                className="text-brand-orange-ink font-semibold sm:w-40 sm:shrink-0"
              >
                {milestone.label}
              </time>
              <span className="text-ink">{milestone.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sections" className="space-y-4">
        <h2 id="sections" className="text-ink text-xl font-bold">
          Les sections
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {ADMIN_SECTIONS.map((section) => (
            <li key={section.slug}>
              <Link
                href={`/admin/${section.slug}`}
                className="border-line bg-surface hover:border-brand-blue block rounded-xl border p-4 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-ink font-semibold">
                    {section.label}
                  </span>
                  {section.status === "comingSoon" && (
                    <Badge tone="neutral">{section.epic}</Badge>
                  )}
                </span>
                <span className="text-ink-muted mt-1 block text-sm">
                  {section.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {pending.length > 0 && (
        <Alert tone="info" title="Rien n’est perdu">
          {pending.length} sections sur {ADMIN_SECTIONS.length} attendent encore
          leur écran. Les emplacements existent pour que chaque lot vienne s’y
          brancher plutôt que de réinventer la coquille et la protection
          d’accès.
        </Alert>
      )}
    </div>
  );
}
