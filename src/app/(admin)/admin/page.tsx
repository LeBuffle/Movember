import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { summarisePayments, type PaymentRow } from "@/lib/accounting/totals";
import { getOverview } from "@/lib/admin/overview";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { formatEuros } from "@/lib/registration/tiers";
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

  const overview = await getOverview();

  // Same figure as the Collecte screen, computed the same way — from one
  // function, so the home page and the detail can never disagree.
  const { data: payments } = await supabase
    .from("payments")
    .select("kind, gross_cents, fee_cents, donation_cents, counterpart_cents");

  const collection = summarisePayments((payments ?? []) as PaymentRow[]);

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
          Ce qui demande votre attention aujourd’hui, puis l’état de l’édition.
        </p>
      </div>

      {/* First, because it is the first question of a November morning: did
          this morning's draw work? Each alert carries the address of the
          screen that resolves it — an alert that leads nowhere is a worry,
          not information. */}
      {overview.alerts.length > 0 && (
        <section aria-labelledby="attention" className="space-y-3">
          <h2 id="attention" className="text-ink text-xl font-bold">
            À traiter
          </h2>

          {overview.alerts.map((alert) => (
            <Alert key={alert.title} tone={alert.tone} title={alert.title}>
              <p>{alert.detail}</p>
              <p className="mt-3">
                <Link
                  href={alert.href}
                  className={buttonClasses({ size: "sm" })}
                >
                  {alert.action}
                </Link>
              </p>
            </Alert>
          ))}
        </section>
      )}

      <section aria-labelledby="aujourdhui" className="space-y-4">
        <h2 id="aujourdhui" className="text-ink text-xl font-bold">
          Aujourd’hui
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardTitle>Participants actifs</CardTitle>
            <CardBody>
              <p className="text-brand-blue text-3xl font-extrabold">
                {overview.participants}
              </p>
              <p className="mt-1 text-sm">Inscriptions payées et actives.</p>
            </CardBody>
          </Card>

          <Card accent={overview.participants > 0 && overview.assigned === 0}>
            <CardTitle>Défis attribués</CardTitle>
            <CardBody>
              <p className="text-brand-blue text-3xl font-extrabold">
                {overview.assigned}
              </p>
              <p className="mt-1 text-sm">
                Pour la journée du jour.{" "}
                <Link
                  href="/admin/defis/attribution"
                  className="underline underline-offset-4"
                >
                  L’attribution
                </Link>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardTitle>Déjà réussis</CardTitle>
            <CardBody>
              <p className="text-brand-blue text-3xl font-extrabold">
                {overview.completed}
              </p>
              <p className="mt-1 text-sm">
                Validés par une sortie remontée, sans rien à déclarer.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* In days, not in a percentage. "34 défis restants" says nothing;
            "le catalogue tient onze jours" says when to get to work. */}
        <Card
          accent={
            overview.catalogue.daysLeft !== null &&
            overview.catalogue.daysLeft <= 7
          }
        >
          <CardTitle>Le catalogue</CardTitle>
          <CardBody>
            <p>
              <strong className="text-ink">
                {overview.catalogue.available} défi
                {overview.catalogue.available > 1 ? "s" : ""} disponible
                {overview.catalogue.available > 1 ? "s" : ""}
              </strong>
              {overview.catalogue.daysLeft !== null && (
                <>
                  {" "}
                  — de quoi tenir environ{" "}
                  <strong className="text-ink">
                    {overview.catalogue.daysLeft} jour
                    {overview.catalogue.daysLeft > 1 ? "s" : ""}
                  </strong>{" "}
                  au rythme de {overview.catalogue.dailyNeed} participant
                  {overview.catalogue.dailyNeed > 1 ? "s" : ""} par jour.
                </>
              )}
              {overview.catalogue.daysLeft === null && (
                <>
                  {" "}
                  — aucun participant actif pour l’instant, donc rien à
                  projeter.
                </>
              )}
            </p>
            <p className="mt-2 text-sm">
              {overview.catalogue.used} attribution
              {overview.catalogue.used > 1 ? "s" : ""} depuis le début.{" "}
              <Link
                href="/admin/defis"
                className="underline underline-offset-4"
              >
                Gérer le catalogue
              </Link>
            </p>
          </CardBody>
        </Card>
      </section>

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
              <p className="text-brand-blue text-3xl font-extrabold">
                {formatEuros(collection.grossCents)}
              </p>
              <p className="mt-1 text-sm">
                {collection.complete
                  ? "Encaissé, frais connus. "
                  : "Provisoire : des frais restent à connaître. "}
                <Link
                  href="/admin/collecte"
                  className="underline underline-offset-4"
                >
                  Voir le détail
                </Link>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardTitle>Journal</CardTitle>
            <CardBody>
              <p className="text-sm">
                Ce que l’organisation a fait : arbitrages, remboursements,
                publications, envois.{" "}
                <Link
                  href="/admin/journal"
                  className="underline underline-offset-4"
                >
                  Ouvrir le journal
                </Link>
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
